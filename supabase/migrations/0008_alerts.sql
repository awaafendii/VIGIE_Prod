-- ============================================================
-- VIGIE — Phase 4 / migration 0008 : alertes précoces de crédit
-- ------------------------------------------------------------
-- À chaque nouvelle évaluation historisée, si le risque se DÉGRADE par
-- rapport à l'évaluation précédente (état qui empire, ou score qui chute
-- d'au moins un seuil), le serveur crée une alerte. Elle est lisible par
-- la PME ET par une institution disposant d'un consentement actif
-- ('assessments') — c'est l'alerte précoce du prêteur.
--
-- Les écritures (création par le moteur) passent par la clé service_role ;
-- l'acquittement par l'API, après contrôle d'appartenance.
-- ============================================================

create table if not exists app.credit_alerts (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references app.organizations (id) on delete cascade,
  assessment_id          uuid references app.credit_assessments (id) on delete set null,
  previous_assessment_id uuid references app.credit_assessments (id) on delete set null,
  kind                   text not null,                 -- 'etat' | 'score'
  severity               text not null check (severity in ('haute','moyenne','faible')),
  from_score             integer,
  to_score               integer,
  from_etat              text,
  to_etat                text,
  delta                  integer,                       -- variation de score (négatif = dégradation)
  message                text,
  status                 text not null default 'open' check (status in ('open','ack')),
  acknowledged_by        uuid references auth.users (id),
  acknowledged_at        timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists idx_alerts_org on app.credit_alerts (org_id, status, created_at desc);

-- ---------- RLS : membre de la PME OU institution avec consentement actif ----------
alter table app.credit_alerts enable row level security;

drop policy if exists alerts_select_member on app.credit_alerts;
create policy alerts_select_member on app.credit_alerts
  for select using (app.is_member(org_id));

drop policy if exists alerts_select_granted on app.credit_alerts;
create policy alerts_select_granted on app.credit_alerts
  for select using (app.has_grant(org_id, 'assessments'));

-- Écritures (insert/update) : clé service_role uniquement (moteur + API après contrôle).
