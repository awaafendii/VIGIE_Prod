/* /api/alerts — alertes précoces de crédit (Phase 4)
   ------------------------------------------------------------
   GET  ?orgId=[&ouvertes=1] : alertes d'une PME. Visibles par un membre
        de la PME OU par une institution disposant d'un consentement actif
        ('assessments') — la RLS (migration 0008) applique cette règle.
   POST { action:'ack', orgId, alertId } : un membre de la PME acquitte
        une alerte (clôt le signal). Écriture via service_role après contrôle.

   Non configuré → 501 (mode démo intact).
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured, admin } from "../_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "../_lib/auth.js";

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
    const url = new URL(req.url, "http://x");
    const orgId = url.searchParams.get("orgId");
    const ouvertes = url.searchParams.get("ouvertes");
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    const cli = clientUtilisateur(u); // la RLS borne à : membre OU consentement actif
    let q = cli.from("credit_alerts")
      .select("id, org_id, kind, severity, from_score, to_score, from_etat, to_etat, delta, message, status, created_at")
      .eq("org_id", orgId);
    if (ouvertes) q = q.eq("status", "open");
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { alertes: data });
  }

  if (req.method === "POST") {
    const { action, orgId, alertId } = await corps(req);
    if (action !== "ack") return json(res, 400, { erreur: "action" });
    if (!orgId || !alertId) return json(res, 400, { erreur: "payload" });
    if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" }); // acquittement réservé à la PME
    const w = await admin().from("credit_alerts")
      .update({ status: "ack", acknowledged_by: u.id, acknowledged_at: new Date().toISOString() })
      .eq("id", alertId).eq("org_id", orgId).eq("status", "open")
      .select("id, status").maybeSingle();
    if (w.error) return json(res, 500, { erreur: "ecriture", message: w.error.message });
    if (!w.data) return json(res, 404, { erreur: "introuvable" });
    await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "alert.ack", targetType: "credit_alert", targetId: alertId });
    return json(res, 200, { alerte: w.data });
  }

  return json(res, 405, { erreur: "methode" });
}
