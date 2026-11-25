/* /api/grants — consentements de partage PME → institution (Phase 3)
   ------------------------------------------------------------
   GET  ?orgId= : consentements où l'org est PME OU institution (RLS).
   POST { action:'grant', pmeOrgId, institutionOrgId, scopes[], expiresAt?, note? }
        : l'auteur doit être membre de la PME avec un rôle habilité
          (owner | finance_manager). Accorde / met à jour + journalise.
   POST { action:'revoke', grantId, pmeOrgId }
        : l'auteur doit être membre de la PME. Révoque + journalise.

   Règle d'or : aucune autorisation ne vient du front. On vérifie
   identité → appartenance PME → rôle AVANT toute écriture. Non
   configuré → 501 (mode démo intact).
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "../_lib/auth.js";
import { client, accorder, revoquer, peutPartager, scopesValides } from "../_lib/consent.js";

async function corps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let b = ""; for await (const m of req) { b += m; if (b.length > 100000) break; }
  try { return b ? JSON.parse(b) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  if (req.method === "GET") {
    const orgId = new URL(req.url, "http://x").searchParams.get("orgId");
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" });
    const cli = clientUtilisateur(u);
    const { data, error } = await cli
      .from("data_access_grants")
      .select("id, pme_org_id, institution_org_id, scopes, status, granted_at, expires_at, revoked_at, note")
      .or(`pme_org_id.eq.${orgId},institution_org_id.eq.${orgId}`)
      .order("updated_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { grants: data });
  }

  if (req.method === "POST") {
    const b = await corps(req);
    const action = b.action || "grant";

    if (action === "grant") {
      const { pmeOrgId, institutionOrgId, scopes, expiresAt, note } = b;
      if (!pmeOrgId || !institutionOrgId) return json(res, 400, { erreur: "payload" });
      if (pmeOrgId === institutionOrgId) return json(res, 400, { erreur: "meme_org" });
      if (!scopesValides(scopes).length) return json(res, 400, { erreur: "scopes" });
      const m = await membre(u.id, pmeOrgId);                 // l'auteur doit appartenir à LA PME
      if (!m) return json(res, 403, { erreur: "acces" });
      if (!peutPartager(m.role)) return json(res, 403, { erreur: "role", message: "Rôle insuffisant pour partager les données de la PME." });
      const g = await accorder(client(), { pmeOrgId, institutionOrgId, scopes, expiresAt, note, actorUser: u.id });
      await journaliser(req, { actorUser: u.id, actorOrg: pmeOrgId, action: "grant.accord", targetOrg: institutionOrgId, targetType: "data_access_grant", targetId: g.id, scope: (g.scopes || []).join(","), payload: { expiresAt: expiresAt || null } });
      return json(res, 200, { grant: g });
    }

    if (action === "revoke") {
      const { grantId, pmeOrgId } = b;
      if (!grantId || !pmeOrgId) return json(res, 400, { erreur: "payload" });
      const m = await membre(u.id, pmeOrgId);
      if (!m) return json(res, 403, { erreur: "acces" });
      if (!peutPartager(m.role)) return json(res, 403, { erreur: "role" });
      const g = await revoquer(client(), { grantId, pmeOrgId, actorUser: u.id });
      if (!g) return json(res, 404, { erreur: "introuvable", message: "Partage inconnu ou déjà révoqué." });
      await journaliser(req, { actorUser: u.id, actorOrg: pmeOrgId, action: "grant.revocation", targetType: "data_access_grant", targetId: grantId });
      return json(res, 200, { grant: g });
    }

    return json(res, 400, { erreur: "action" });
  }

  return json(res, 405, { erreur: "methode" });
}
