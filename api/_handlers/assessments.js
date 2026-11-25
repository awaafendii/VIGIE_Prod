/* /api/assessments — évaluations de crédit historisées (Phase 2)
   ------------------------------------------------------------
   GET  ?orgId= : historique des évaluations de la PME (RLS appliquée).
   POST { orgId } : recalcule l'évaluation officielle côté serveur à
                    partir des transactions persistées et l'historise.
                    Rôles requis : owner | finance_manager | accountant.
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "../_lib/auth.js";
import { client, peutEcrire, evaluerEtHistoriser } from "../_lib/finance.js";

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
    const { data, error } = await cli.from("credit_assessments")
      .select("id, score, etat, period_start, period_end, computed_at, model_version_id, snapshot")
      .eq("org_id", orgId).order("computed_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { assessments: data });
  }

  if (req.method === "POST") {
    const { orgId } = await corps(req);
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    const m = await membre(u.id, orgId);
    if (!m) return json(res, 403, { erreur: "acces" });
    if (!peutEcrire(m.role)) return json(res, 403, { erreur: "role" });
    const assessment = await evaluerEtHistoriser(client(), { orgId, computedBy: u.id });
    await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "assessment.compute", targetOrg: orgId, targetType: "credit_assessment", targetId: assessment?.id });
    return json(res, 200, { assessment });
  }

  return json(res, 405, { erreur: "methode" });
}
