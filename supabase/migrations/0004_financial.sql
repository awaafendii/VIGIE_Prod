-- ============================================================
-- VIGIE — Phase 2 / migration 0004 : persistance financière
-- ------------------------------------------------------------
-- Comptes, intégrations (connecteurs par PME), historique des imports,
-- lignes sources (raw) et transactions normalisées + règlements.
-- Idempotence : UNIQUE(org_id, source, source_ref) sur transactions ;
--               UNIQUE(org_id, file_hash) sur import_batches.
-- Isolation : RLS PME-only. L'accès institution viendra des
--             autorisations de partage (Phase 3) — rien ici.
-- ============================================================

-- ---------- comptes financiers (banque / mobile money / caisse) ----------
create table if not exists app.financial_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references app.organizations (id) on delete cascade,
  kind        text not null check (kind in ('bank', 'mobile_money', 'cash')),
  label       text not null,
  canal       text,
  currency    text not null default 'XOF',
  created_at  timestamptz not null default now()
);
create index if not exists idx_accounts_org on app.financial_accounts (org_id);

-- ---------- intégrations (compte marchand d'un connecteur, par PME) ----------
-- credentials_enc : secret chiffré côté serveur. JAMAIS renvoyé au client.
create table if not exists app.integrations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references app.organizations (id) on delete cascade,
  provider         text not null check (provider in ('cinetpay')),
  external_site_id text,                       -- ex. cpm_site_id CinetPay
  credentials_enc  bytea,
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  unique (provider, external_site_id)
);
create index if not exists idx_integrations_org on app.integrations (org_id);

-- ---------- lots d'import (historique + empreinte du fichier) ----------
create table if not exists app.import_batches (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references app.organizations (id) on delete cascade,
  uploaded_by    uuid references auth.users (id),
  filename       text,
  file_hash      text,                         -- empreinte du fichier source
  storage_path   text,                         -- emplacement du fichier d'origine (stockage sécurisé)
  period_start   date,
  period_end     date,
  engine_version text,                         -- version du moteur d'analyse ayant traité le lot
  rows_total     integer not null default 0,
  rows_accepted  integer not null default 0,
  rows_rejected  integer not null default 0,
  status         text not null default 'processed',
  created_at     timestamptz not null default now(),
  unique (org_id, file_hash)                   -- double import du même fichier bloqué
);
create index if not exists idx_batches_org on app.import_batches (org_id, created_at desc);

-- ---------- lignes sources brutes (traçabilité : acceptées ET rejetées) ----------
create table if not exists app.raw_transactions (
  id            bigint generated always as identity primary key,
  batch_id      uuid not null references app.import_batches (id) on delete cascade,
  org_id        uuid not null references app.organizations (id) on delete cascade,
  line_no       integer,
  payload       jsonb,
  reject_reason text
);
create index if not exists idx_raw_batch on app.raw_transactions (batch_id);

-- ---------- transactions normalisées (forme exploitée par analyse.js) ----------
create table if not exists app.transactions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references app.organizations (id) on delete cascade,
  account_id     uuid references app.financial_accounts (id) on delete set null,
  source         text not null check (source in ('import', 'cinetpay', 'manual')),
  source_ref     text not null,                -- référence stable → idempotence
  dir            text not null check (dir in ('ENTREE', 'SORTIE')),
  occurred_on    date not null,
  amount         numeric(18,2) not null check (amount > 0),
  canal          text,
  tiers          text,
  libelle        text,
  status         text not null default 'Payé',
  batch_id       uuid references app.import_batches (id) on delete set null,
  integration_id uuid references app.integrations (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (org_id, source, source_ref)
);
create index if not exists idx_tx_org_period on app.transactions (org_id, occurred_on);

-- ---------- règlements des prestataires (rapprochement, Phase 3) ----------
create table if not exists app.settlements (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references app.organizations (id) on delete cascade,
  integration_id uuid references app.integrations (id) on delete set null,
  provider_ref   text,
  net_amount     numeric(18,2),
  fees           numeric(18,2),
  settled_on     date,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  unique (org_id, provider_ref)
);

-- ---------- RLS : PME-only (membres de l'organisation) ----------
alter table app.financial_accounts enable row level security;
alter table app.integrations       enable row level security;
alter table app.import_batches     enable row level security;
alter table app.raw_transactions   enable row level security;
alter table app.transactions       enable row level security;
alter table app.settlements        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['financial_accounts','integrations','import_batches','raw_transactions','transactions','settlements']
  loop
    execute format('drop policy if exists %I_select_member on app.%I;', t, t);
    execute format('create policy %I_select_member on app.%I for select using (app.is_member(org_id));', t, t);
  end loop;
end $$;

-- Écritures (insert/update/delete) : clé service_role uniquement (API, après
-- vérification d'identité + rôle). Aucune policy d'écriture utilisateur.
-- Rappel : credentials_enc ne doit jamais être sélectionné pour un client.
