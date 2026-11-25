-- ============================================================
-- VIGIE — Phase 1 / migration 0002 : Row Level Security (identité)
-- ------------------------------------------------------------
-- Seconde ligne de défense. L'autorisation métier reste faite
-- côté API ; la RLS garantit qu'un oubli applicatif ne fuite rien.
--
-- Les helpers sont SECURITY DEFINER pour contourner la RLS pendant
-- l'évaluation des politiques (sinon récursion infinie sur members).
-- Les écritures sur organizations / organization_members passent par
-- la clé service_role (API, transactionnel) : pas de policy d'insert
-- utilisateur, pour empêcher toute escalade de privilèges.
-- ============================================================

-- ---------- helpers d'appartenance ----------
create or replace function app.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select org_id from app.organization_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function app.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.organization_members
    where user_id = auth.uid() and org_id = org and status = 'active'
  );
$$;

-- ---------- activation RLS ----------
alter table app.profiles             enable row level security;
alter table app.organizations        enable row level security;
alter table app.organization_members enable row level security;

-- ---------- profiles : chacun ne voit/modifie que le sien ----------
drop policy if exists profiles_select_own on app.profiles;
create policy profiles_select_own on app.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_own on app.profiles;
create policy profiles_update_own on app.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- organizations : visibles aux membres (+ démo visible à tous) ----------
drop policy if exists orgs_select_member on app.organizations;
create policy orgs_select_member on app.organizations
  for select using (is_demo = true or app.is_member(id));

-- Pas de policy insert/update/delete : réservé à la clé service_role (API).

-- ---------- organization_members : voir ses co-membres, son propre lien ----------
drop policy if exists members_select_scoped on app.organization_members;
create policy members_select_scoped on app.organization_members
  for select using (user_id = auth.uid() or org_id in (select app.my_org_ids()));

-- Pas de policy insert/update/delete : réservé à la clé service_role (API).
