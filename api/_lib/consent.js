/* ============================================================
   VIGIE — consentements de partage (serveur)
   ------------------------------------------------------------
   Autorisation MÉTIER des accès inter-organisations. Une institution ne
   consulte une PME que via un consentement ACTIF, NON EXPIRÉ, couvrant le
   scope demandé. Cette vérification est faite ici (API) ET par la RLS
   (fonction app.has_grant, migration 0006) : défense en profondeur.

   Les écritures passent par la clé service_role (admin), toujours APRÈS
   que la route a vérifié l'identité + l'appartenance + le rôle de la PME.
   ============================================================ */
import { admin } from "./db.js";

export const SCOPES = ["assessments", "transactions", "recommendations"];
// Rôles PME habilités à accorder / révoquer un partage (décision de gestion).
const ROLES_PME_PARTAGE = ["owner", "finance_manager"];
export const peutPartager = (role) => ROLES_PME_PARTAGE.includes(role);

export const scopesValides = (arr) =>
  Array.isArray(arr) ? [...new Set(arr.filter((s) => SCOPES.includes(s)))] : [];

// Consentement actif (non expiré) de pme → institution couvrant `scope` ?
// Source de vérité serveur, indépendante de la RLS. Renvoie la ligne ou null.
export async function grantActif(cli, pmeOrgId, institutionOrgId, scope) {
  const { data, error } = await cli
    .from("data_access_grants")
    .select("id, scopes, status, expires_at")
    .eq("pme_org_id", pmeOrgId)
    .eq("institution_org_id", institutionOrgId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  if (scope && !(data.scopes || []).includes(scope)) return null;
  return data;
}

// Accorde ou met à jour un consentement (upsert sur le lien unique pme↔institution).
// Journalise l'action dans grant_events. `cli` = admin().
export async function accorder(cli, { pmeOrgId, institutionOrgId, scopes, expiresAt, note, actorUser }) {
  const scopesOk = scopesValides(scopes);
  const existant = await cli
    .from("data_access_grants")
    .select("id")
    .eq("pme_org_id", pmeOrgId)
    .eq("institution_org_id", institutionOrgId)
    .maybeSingle();

  const champs = {
    pme_org_id: pmeOrgId, institution_org_id: institutionOrgId,
    scopes: scopesOk, status: "active",
    granted_by: actorUser || null, granted_at: new Date().toISOString(),
    expires_at: expiresAt || null, revoked_by: null, revoked_at: null,
    note: note || null, updated_at: new Date().toISOString(),
  };

  const up = await cli
    .from("data_access_grants")
    .upsert(champs, { onConflict: "pme_org_id,institution_org_id" })
    .select("id, scopes, status, expires_at, granted_at")
    .single();
  if (up.error) throw new Error(up.error.message);

  await cli.from("grant_events").insert({
    grant_id: up.data.id, actor_user: actorUser || null,
    event: existant.data ? "updated" : "granted", scopes: scopesOk,
  });
  return up.data;
}

// Révoque un consentement (par son id, après vérification que la PME en est propriétaire).
export async function revoquer(cli, { grantId, pmeOrgId, actorUser }) {
  const up = await cli
    .from("data_access_grants")
    .update({ status: "revoked", revoked_by: actorUser || null, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("pme_org_id", pmeOrgId)          // garde-fou : on ne révoque que SON propre partage
    .eq("status", "active")
    .select("id, scopes, status")
    .maybeSingle();
  if (up.error) throw new Error(up.error.message);
  if (!up.data) return null;             // rien à révoquer (id inconnu ou déjà révoqué)
  await cli.from("grant_events").insert({ grant_id: grantId, actor_user: actorUser || null, event: "revoked" });
  return up.data;
}

export const client = () => admin();
