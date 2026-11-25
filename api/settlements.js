/* /api/settlements — versements de l'agrégateur & rapprochement (Phase 4)
   ------------------------------------------------------------
   GET  ?orgId=[&mois=AAAA-MM] : rapprochement (brut encaissé vs net reversé
        + frais + écart indicatif) et liste des versements (RLS PME).
   POST { action:'record', orgId, providerRef, netAmount, fees?, settledOn?, integrationId? }
        : enregistre un versement reçu (idempotent). Rôles PME : owner/finance_manager.

   Non configuré → 501 (mode démo intact).
   ============================================================ */
import { json } from "./_lib/securite.js";
import { configured, admin } from "./_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "./_lib/auth.js";
import { persistSettlement, rapprocher } from "./_lib/settlements.js";

const ROLES_ECRITURE = ["owner", "finance_manager"];

async function corps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let b = ""; for await (const m of req) { b += m; if (b.length > 200000) break; }
  try { return b ? JSON.parse(b) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const orgId = url.searchParams.get("orgId");
    const mois = url.searchParams.get("mois");
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" });
    const rap = await rapprocher(clientUtilisateur(u), orgId, mois);
    return json(res, 200, { rapprochement: rap });
  }

  if (req.method === "POST") {
    const b = await corps(req);
    const action = b.action || "record";
    if (action !== "record" && action !== "import") return json(res, 400, { erreur: "action" });

    const { orgId } = b;
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    const m = await membre(u.id, orgId);
    if (!m) return json(res, 403, { erreur: "acces" });
    if (!ROLES_ECRITURE.includes(m.role)) return json(res, 403, { erreur: "role", message: "Rôle insuffisant pour enregistrer un versement." });
    const cli = admin();

    // Ingestion par lot (relevé exporté poussé par un script/cron).
    if (action === "import") {
      const lignes = Array.isArray(b.lignes) ? b.lignes.slice(0, 2000) : null;
      if (!lignes?.length) return json(res, 400, { erreur: "lignes" });
      let ok = 0, rejets = 0;
      for (const l of lignes) {
        const net = Number(l.netAmount ?? l.net);
        if (!l || !l.providerRef || !(net >= 0) || (l.settledOn && !/^\d{4}-\d{2}-\d{2}$/.test(l.settledOn))) { rejets++; continue; }
        try { await persistSettlement(cli, { orgId, integrationId: l.integrationId, providerRef: l.providerRef, netAmount: net, fees: l.fees, settledOn: l.settledOn || null }); ok++; }
        catch { rejets++; }
      }
      await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "settlement.import", targetType: "settlement", payload: { ok, rejets, total: lignes.length } });
      return json(res, 200, { importes: ok, rejets, total: lignes.length });
    }

    // Enregistrement unitaire.
    const { providerRef, netAmount, fees, settledOn, integrationId } = b;
    if (!providerRef || netAmount == null) return json(res, 400, { erreur: "payload" });
    if (!(Number(netAmount) >= 0)) return json(res, 400, { erreur: "montant" });
    if (settledOn && !/^\d{4}-\d{2}-\d{2}$/.test(settledOn)) return json(res, 400, { erreur: "date" });
    const s = await persistSettlement(cli, { orgId, integrationId, providerRef, netAmount, fees, settledOn });
    await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "settlement.record", targetType: "settlement", targetId: s.id, payload: { ref: String(providerRef) } });
    return json(res, 200, { settlement: s });
  }

  return json(res, 405, { erreur: "methode" });
}
