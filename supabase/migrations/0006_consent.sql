-- ============================================================
-- VIGIE — Phase 3 / migration 0006 : consentements de partage PME → institution
-- ------------------------------------------------------------
-- Une PME autorise EXPLICITEMENT une institution à consulter certaines de
-- ses données. L'autorisation est :
--   • granulaire  : un tableau de « scopes » (assessments / transactions / recommendations) ;
--   • datée       : expires_at (null = sans échéance) ;
--   • révocable   : status 'revoked' + revoked_at, à tout moment par la PME.
-- L'historique des actions (accord, mise à jour, révocation) est conservé
-- dans grant_events (append-only).
--
-- Règle d'or (rappel) : AUCUN changement d'espace dans React n'autorise
-- quoi que ce soit. L'institution ne voit une PME que via un consentement
-- ACTIF et NON EXPIRÉ — vérifié ici (RLS) ET côté API.
-- ============================================================

-- ---------- consentements (état courant d'un lien PME ↔ institution) ----------
create table if not exists app.data_access_grants (
  id                 uuid primary key default gen_random_uuid(),
  pme_org_id         uuid not null references app.organizations (id) on delete cascade,
  institution_org_id uuid not null references app.organizations (id) on delete cascade,
  scopes             text[] not null default '{}',     -- ex. {'assessments','transactions','recommendations'}
  status             text not null default 'active' check (status in ('active','revoked','expired')),
  granted_by         uuid references auth.users (id),
  granted_at         timestamptz not null default now(),
  expires_at         timestamptz,                       -- null = sans échéance
  revoked_by         uuid references auth.users (id),
  revoked_at         timestamptz,
  note               text,
  updated_at         timestamptz not null default now(),
  unique (pme_org_id, institution_org_id)               -- un lien unique ; on met à jour scopes/status
);
create index if not exists idx_grants_pme  on app.data_access_grants (pme_org_id);
create index if not exists idx_grants_inst on app.data_access_grants (institution_org_id, status);

-- ---------- journal des consentements (traçabilité des actions) ----------
create table if not exists app.grant_events (
  id         bigint generated always as identity primary key,
  grant_id   uuid not null references app.data_access_grants (id) on delete cascade,
  actor_user uuid references auth.users (id),
  event      text not null,                             -- 'granted' | 'updated' | 'revoked' | 'expired'
  scopes     text[],
  payload    jsonb,
  at         timestamptz not null default now()
);
create index if not exists idx_grant_events on app.grant_events (grant_id, at);

-- ---------- helper : l'utilisateur courant détient-il un consentement actif ? ----------
-- true si l'utilisateur est membre actif d'une institution titulaire d'un
-- consentement ACTIF, NON EXPIRÉ, de la PME `pme`, couvrant `scope`.
-- SECURITY DEFINER : contourne la RLS pendant l'évaluation des policies.
create or replace function app.has_grant(pme uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
    from app.data_access_grants g
    join app.organization_members m on m.org_id = g.institution_org_id
    where g.pme_org_id = pme
      and m.user_id = auth.uid()
      and m.status = 'active'
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
      and scope = any (g.scopes)
  );
$$;

-- ---------- RLS : consentements ----------
alter table app.data_access_grants enable row level security;
alter table app.grant_events       enable row level security;

-- Les deux parties (PME et institution) voient le lien qui les concerne.
drop policy if exists grants_select_parties on app.data_access_grants;
create policy grants_select_parties on app.data_access_grants
  for select using (app.is_member(pme_org_id) or app.is_member(institution_org_id));

drop policy if exists grant_events_select_parties on app.grant_events;
create policy grant_events_select_parties on app.grant_events
  for select using (exists (
    select 1 from app.data_access_grants g
    where g.id = grant_id
      and (app.is_member(g.pme_org_id) or app.is_member(g.institution_org_id))
  ));

-- Écritures : clé service_role uniquement (API, après contrôle d'identité + rôle PME).

-- ---------- policies ADDITIVES : accès institution borné au consentement ----------
-- PostgreSQL combine plusieurs policies permissives par OU : on AJOUTE donc à
-- « membre de la PME » le cas « institution titulaire d'un consentement ».
drop policy if exists assess_select_granted on app.credit_assessments;
create policy assess_select_granted on app.credit_assessments
  for select using (app.has_grant(org_id, 'assessments'));

drop policy if exists risk_select_granted on app.risk_indicators;
create policy risk_select_granted on app.risk_indicators
  for select using (app.has_grant(org_id, 'assessments'));

drop policy if exists tx_select_granted on app.transactions;
create policy tx_select_granted on app.transactions
  for select using (app.has_grant(org_id, 'transactions'));
