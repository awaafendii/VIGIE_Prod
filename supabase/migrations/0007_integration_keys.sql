-- ============================================================
-- VIGIE — Phase 4 / migration 0007 : clés marchand chiffrées au repos
-- ------------------------------------------------------------
-- Pour vérifier un paiement CinetPay multi-marchand, le serveur a besoin de
-- la CLÉ du marchand concerné. On la stocke CHIFFRÉE (AES-256-GCM, clé maître
-- VIGIE_ENC_KEY côté serveur) dans `credentials_sealed` (base64 du blob scellé).
--
-- Défense en profondeur : même via la RLS, aucun client ne doit lire ce secret.
-- On RÉVOQUE donc le privilège de lecture sur les colonnes de secret pour les
-- rôles applicatifs (authenticated / anon). L'API ne les sélectionne jamais ;
-- seule la clé service_role (admin) peut les lire côté serveur.
-- ============================================================

alter table app.integrations add column if not exists credentials_sealed   text;        -- blob AES-256-GCM, base64 (secret)
alter table app.integrations add column if not exists key_version          smallint;    -- version de la clé maître ayant scellé
alter table app.integrations add column if not exists credentials_added_at timestamptz; -- dernière mise à jour du secret

-- Révocation du privilège de lecture des colonnes de secret (si les rôles existent).
do $$
begin
  begin revoke select (credentials_sealed) on app.integrations from authenticated; exception when others then null; end;
  begin revoke select (credentials_sealed) on app.integrations from anon;          exception when others then null; end;
  begin revoke select (credentials_enc)    on app.integrations from authenticated; exception when others then null; end;
  begin revoke select (credentials_enc)    on app.integrations from anon;          exception when others then null; end;
end $$;
