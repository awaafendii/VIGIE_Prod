-- ============================================================
-- VIGIE — Phase 1 / migration 0003 : journal d'audit
-- ------------------------------------------------------------
-- Toute action sensible (connexion, lecture de données d'une PME
-- par une institution, modification de membres…) laisse une trace.
-- Écriture exclusivement via la clé service_role (API). RLS activée
-- sans policy de lecture utilisateur : les journaux ne sont pas
-- exposés aux clients en Phase 1 (consultation réservée à l'ADMIN,
-- ouverte dans une phase ultérieure).
-- ============================================================

create table if not exists app.audit_logs (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor_user   uuid references auth.users (id),
  actor_org    uuid references app.organizations (id),
  action       text not null,                 -- ex. 'auth.login', 'members.add', 'pme.view'
  target_org   uuid references app.organizations (id),
  target_type  text,                           -- ex. 'organization', 'transaction'
  target_id    text,
  scope        text,                           -- périmètre consulté le cas échéant
  ip           inet,
  user_agent   text,
  payload      jsonb
);

create index if not exists idx_audit_actor  on app.audit_logs (actor_user, at desc);
create index if not exists idx_audit_target on app.audit_logs (target_org, at desc);

alter table app.audit_logs enable row level security;
-- Aucune policy : lecture/écriture réservées à la clé service_role (qui contourne la RLS).
