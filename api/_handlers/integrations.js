/* /api/integrations — connecteurs marchand d'une PME (Phase 4)
   ------------------------------------------------------------
   GET  ?orgId= : liste des intégrations de la PME, SANS secret.
   POST { action:'register', orgId, externalSiteId, apikey, base? }
        : enregistre/met à jour la clé d'un compte marchand CinetPay.
          La clé est CHIFFRÉE au repos (AES-256-GCM) et n'est JAMAIS renvoyée.
          Rôles PME : owner | finance_manager.
   POST { action:'revoke', orgId, integrationId } : désactive l'intégration.

   Garde-fous de sécurité :
   • identité → appartenance PME → rôle, avant toute écriture ;
   • un site marchand déjà rattaché à UNE AUTRE organisation est refusé (409) :
     pas de détournement des encaissements d'une autre PME ;
   • sans clé de chiffrement serveur, on refuse (501) plutôt que stocker en clair.
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured, admin } from "../_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "../_lib/auth.js";
import { chiffrementDispo, sceller, versionActive } from "../_lib/crypto.js";

const ROLES_ECRITURE = ["owner", "finance_manager"];

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
    // Jamais de colonne de secret ici (credentials_sealed / credentials_enc).
    const { data, error } = await cli
      .from("integrations")
      .select("id, provider, external_site_id, status, created_at, credentials_added_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { integrations: data });
  }

  if (req.method === "POST") {
    const b = await corps(req);
    const action = b.action || "register";

    if (action === "register") {
      const { orgId, externalSiteId, apikey, base } = b;
      if (!orgId || !externalSiteId || !apikey) return json(res, 400, { erreur: "payload" });
      const m = await membre(u.id, orgId);
      if (!m) return json(res, 403, { erreur: "acces" });
      if (!ROLES_ECRITURE.includes(m.role)) return json(res, 403, { erreur: "role", message: "Rôle insuffisant pour connecter un compte marchand." });
      if (!chiffrementDispo()) return json(res, 501, { erreur: "chiffrement_indisponible", message: "Clé de chiffrement serveur (VIGIE_ENC_KEY) absente : enregistrement refusé." });

      const cli = admin();
      // Anti-détournement : un site déjà rattaché à une AUTRE organisation est refusé.
      const ex = await cli.from("integrations").select("id, org_id").eq("provider", "cinetpay").eq("external_site_id", String(externalSiteId)).maybeSingle();
      if (ex.data && ex.data.org_id !== orgId) return json(res, 409, { erreur: "site_pris", message: "Ce compte marchand est déjà rattaché à une autre organisation." });

      const sealed = sceller({ apikey: String(apikey), siteId: String(externalSiteId), base: base ? String(base) : null });
      const champs = {
        org_id: orgId, provider: "cinetpay", external_site_id: String(externalSiteId),
        credentials_sealed: sealed, key_version: versionActive(), credentials_added_at: new Date().toISOString(),
        status: "active",
      };
      const w = ex.data
        ? await cli.from("integrations").update(champs).eq("id", ex.data.id).select("id, external_site_id, status, credentials_added_at").single()
        : await cli.from("integrations").insert(champs).select("id, external_site_id, status, credentials_added_at").single();
      if (w.error) return json(res, 500, { erreur: "ecriture", message: w.error.message });
      await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "integration.register", targetType: "integration", targetId: w.data.id, payload: { site: String(externalSiteId) } });
      return json(res, 200, { integration: w.data }); // aucun secret renvoyé
    }

    if (action === "revoke") {
      const { orgId, integrationId } = b;
      if (!orgId || !integrationId) return json(res, 400, { erreur: "payload" });
      const m = await membre(u.id, orgId);
      if (!m) return json(res, 403, { erreur: "acces" });
      if (!ROLES_ECRITURE.includes(m.role)) return json(res, 403, { erreur: "role" });
      const w = await admin().from("integrations").update({ status: "revoked" }).eq("id", integrationId).eq("org_id", orgId).select("id, status").maybeSingle();
      if (w.error) return json(res, 500, { erreur: "ecriture", message: w.error.message });
      if (!w.data) return json(res, 404, { erreur: "introuvable" });
      await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "integration.revoke", targetType: "integration", targetId: integrationId });
      return json(res, 200, { integration: w.data });
    }

    return json(res, 400, { erreur: "action" });
  }

  return json(res, 405, { erreur: "methode" });
}
