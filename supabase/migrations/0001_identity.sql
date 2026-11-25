-- ============================================================
-- VIGIE — Phase 1 / migration 0001 : identité & organisations
-- ------------------------------------------------------------
-- Socle multi-tenant : utilisateurs (profiles), organisations
-- (PME / INSTITUTION / ADMIN) et appartenance avec rôle.
-- Aucune donnée financière ici (migrations ultérieures).
-- Idempotent autant que possible (IF NOT EXISTS) pour rejouabilité.
-- ============================================================

create schema if not exists app;

-- ---------- types ----------
do $$ begin
  create type app.org_type as enum ('PME', 'INSTITUTION', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.member_status as enum ('active', 'invited', 'suspended');
exception when duplicate_object then null; end $$;

-- ---------- profiles : 1 ligne par utilisateur Supabase Auth ----------
create table if not exists app.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  locale      text not null default 'fr',
  created_at  timestamptz not null default now()
);

-- ---------- organizations : PME, institution financière ou admin VIGIE ----------
create table if not exists app.organizations (
  id          uuid primary key default gen_random_uuid(),
  type        app.org_type not null,
  name        text not null,
  slug        text unique,
  is_demo     boolean not null default false,  -- isole le portefeuille fictif des données réelles
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id)
);

-- ---------- organization_members : qui appartient à quoi, avec quel rôle ----------
-- Le rôle est validé côté API selon le type d'organisation :
--   PME         : owner | finance_manager | accountant | viewer
--   INSTITUTION : admin | credit_analyst  | credit_agent | auditor
--   ADMIN       : admin
create table if not exists app.organization_members (
  org_id      uuid not null references app.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null,
  status      app.member_status not null default 'active',
  invited_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_members_user  on app.organization_members (user_id) where status = 'active';
create index if not exists idx_members_org    on app.organization_members (org_id);
create index if not exists idx_orgs_type      on app.organizations (type) where is_demo = false;

-- ---------- création automatique du profil à l'inscription ----------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  insert into app.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
