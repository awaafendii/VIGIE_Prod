-- ============================================================
-- VIGIE — Phase 2 / migration 0005 : scoring & recommandations historisés
-- ------------------------------------------------------------
-- Les évaluations conservent LEUR VERSION DE MODÈLE et un instantané
-- (snapshot) des chiffres ayant produit le score : évaluer une PME en
-- janvier puis en avril conserve les deux résultats et explique l'écart.
-- Les recommandations et leurs échanges sont persistés (plus de perte
-- à l'actualisation).
-- ============================================================

-- ---------- versions du modèle de scoring ----------
create table if not exists app.scoring_model_versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,            -- ex. 'analyse.js@1' ou un hash de config
  params      jsonb,
  deployed_at timestamptz not null default now()
);

-- ---------- évaluations de crédit (historique) ----------
create table if not exists app.credit_assessments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references app.organizations (id) on delete cascade,
  model_version_id uuid references app.scoring_model_versions (id),
  batch_id         uuid references app.import_batches (id) on delete set null,
  computed_at      timestamptz not null default now(),
  computed_by      uuid references auth.users (id),
  period_start     date,
  period_end       date,
  score            integer,
  etat             text,                        -- 'Sain' | 'Vigilance' | 'Alerte précoce'
  signals          jsonb,                       -- les 6 signaux du dernier mois
  snapshot         jsonb                        -- chiffres figés (profil, disponible, prévision…)
);
create index if not exists idx_assess_org on app.credit_assessments (org_id, computed_at desc);

-- ---------- indicateurs de risque (dérivés d'une évaluation) ----------
create table if not exists app.risk_indicators (
  id            bigint generated always as identity primary key,
  assessment_id uuid not null references app.credit_assessments (id) on delete cascade,
  org_id        uuid not null references app.organizations (id) on delete cascade,
  name          text not null,
  value         numeric
);
create index if not exists idx_risk_assess on app.risk_indicators (assessment_id);

-- ---------- recommandations (institution → PME) ----------
create table if not exists app.recommendations (
  id                  uuid primary key default gen_random_uuid(),
  pme_org_id          uuid not null references app.organizations (id) on delete cascade,
  institution_org_id  uuid references app.organizations (id) on delete set null,
  assessment_id       uuid references app.credit_assessments (id) on delete set null,
  author_user         uuid references auth.users (id),
  title               text,
  body                text,
  actions             jsonb,
  level               text,
  status              text not null default 'sent',
  sent_at             timestamptz not null default now()
);
create index if not exists idx_reco_pme on app.recommendations (pme_org_id, sent_at desc);
create index if not exists idx_reco_inst on app.recommendations (institution_org_id, sent_at desc);

-- ---------- échanges autour d'une recommandation (historique) ----------
create table if not exists app.recommendation_events (
  id                 bigint generated always as identity primary key,
  recommendation_id  uuid not null references app.recommendations (id) on delete cascade,
  actor_user         uuid references auth.users (id),
  event              text not null,             -- 'sent' | 'read' | 'reply' | 'action_done' | 'closed'
  payload            jsonb,
  at                 timestamptz not null default now()
);
create index if not exists idx_reco_events on app.recommendation_events (recommendation_id, at);

-- ---------- RLS ----------
alter table app.scoring_model_versions enable row level security;
alter table app.credit_assessments     enable row level security;
alter table app.risk_indicators        enable row level security;
alter table app.recommendations        enable row level security;
alter table app.recommendation_events  enable row level security;

-- Versions de modèle : référentiel lisible par tout utilisateur authentifié.
drop policy if exists smv_select_auth on app.scoring_model_versions;
create policy smv_select_auth on app.scoring_model_versions
  for select using (auth.uid() is not null);

-- Évaluations & indicateurs : membres de la PME.
drop policy if exists assess_select_member on app.credit_assessments;
create policy assess_select_member on app.credit_assessments
  for select using (app.is_member(org_id));

drop policy if exists risk_select_member on app.risk_indicators;
create policy risk_select_member on app.risk_indicators
  for select using (app.is_member(org_id));

-- Recommandations & échanges : membres de la PME OU de l'institution concernée.
drop policy if exists reco_select_parties on app.recommendations;
create policy reco_select_parties on app.recommendations
  for select using (app.is_member(pme_org_id) or app.is_member(institution_org_id));

drop policy if exists reco_events_select_parties on app.recommendation_events;
create policy reco_events_select_parties on app.recommendation_events
  for select using (exists (
    select 1 from app.recommendations r
    where r.id = recommendation_id
      and (app.is_member(r.pme_org_id) or app.is_member(r.institution_org_id))
  ));

-- Écritures : clé service_role uniquement (API, après contrôle d'identité + rôle).
