-- ============================================================
-- VIGIE — script de seed (première organisation PME + institution)
-- ------------------------------------------------------------
-- PRÉREQUIS : les comptes doivent exister dans Supabase Auth AVANT ce script
--   (le trigger on_auth_user_created a alors créé leur app.profiles).
--   Créez-les via l'écran de connexion de l'app, ou Supabase › Authentication,
--   puis récupérez leurs UUID dans auth.users.
--
-- UTILISATION (psql) :
--   psql "$DATABASE_URL" \
--     -v pme_user="'00000000-0000-0000-0000-000000000000'" \
--     -v inst_user="'11111111-1111-1111-1111-111111111111'" \
--     -f supabase/seed.sql
--
-- Dans l'éditeur SQL Supabase (pas de variables -v) : remplacez les deux
-- :pme_user / :inst_user par les UUID entre quotes, ex. '00000000-…-000000000000'.
--
-- Idempotent : rejouable sans créer de doublon (slug unique + ON CONFLICT).
-- Rôles : PME → owner ; INSTITUTION → admin (cf. migration 0001).
-- ============================================================

-- \set ON_ERROR_STOP on   -- (psql) décommentez pour arrêter à la première erreur

do $$
declare
  v_pme_user  uuid := :pme_user;    -- UUID auth.users du responsable PME
  v_inst_user uuid := :inst_user;   -- UUID auth.users du responsable institution
  v_pme_org   uuid;
  v_inst_org  uuid;
begin
  -- Garde-fou : les utilisateurs doivent exister (sinon FK en échec plus loin).
  if not exists (select 1 from auth.users where id = v_pme_user) then
    raise exception 'Utilisateur PME % introuvable dans auth.users (inscrivez-le d''abord).', v_pme_user;
  end if;
  if not exists (select 1 from auth.users where id = v_inst_user) then
    raise exception 'Utilisateur institution % introuvable dans auth.users (inscrivez-le d''abord).', v_inst_user;
  end if;

  -- ---------- PME ----------
  insert into app.organizations (type, name, slug, created_by)
  values ('PME', 'NPM Multiservices', 'npm-multiservices', v_pme_user)
  on conflict (slug) do update set name = excluded.name
  returning id into v_pme_org;

  insert into app.organization_members (org_id, user_id, role, status)
  values (v_pme_org, v_pme_user, 'owner', 'active')
  on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';

  -- ---------- INSTITUTION ----------
  insert into app.organizations (type, name, slug, created_by)
  values ('INSTITUTION', 'Cayor Finance', 'cayor-finance', v_inst_user)
  on conflict (slug) do update set name = excluded.name
  returning id into v_inst_org;

  insert into app.organization_members (org_id, user_id, role, status)
  values (v_inst_org, v_inst_user, 'admin', 'active')
  on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';

  raise notice 'Seed OK — PME % / institution %', v_pme_org, v_inst_org;
end $$;

-- Vérification (optionnelle) :
-- select o.type, o.name, o.slug, m.role, m.status
-- from app.organizations o
-- join app.organization_members m on m.org_id = o.id
-- where o.slug in ('npm-multiservices', 'cayor-finance')
-- order by o.type;
