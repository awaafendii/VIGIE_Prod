/* /api/recommendations — recommandations historisées (Phase 2)
   ------------------------------------------------------------
   GET  ?orgId= : recommandations où l'org est la PME OU l'institution
                  (RLS : seules les parties concernées voient la ligne).
   POST { pmeOrgId, institutionOrgId, assessmentId?, title, body, actions, level }
        : l'auteur doit être membre de l'INSTITUTION avec un rôle habilité.
          Crée la recommandation + un évènement 'sent' (historisé).
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "../_lib/auth.js";
import { client } from "../_lib/finance.js";

const ROLES_INST = ["admin", "credit_analyst", "credit_agent"];

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
    const orgId = new URL(req.url, "http://x").searchParams.get("orgId");
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" });
    const cli = clientUtilisateur(u);
    const { data, error } = await cli.from("recommendations")
      .select("id, pme_org_id, institution_org_id, title, body, actions, level, status, sent_at")
      .or(`pme_org_id.eq.${orgId},institution_org_id.eq.${orgId}`)
      .order("sent_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { recommendations: data });
  }

  if (req.method === "POST") {
    const b = await corps(req);
    const { pmeOrgId, institutionOrgId, assessmentId, title, body, actions, level } = b;
    if (!pmeOrgId || !institutionOrgId || !title) return json(res, 400, { erreur: "payload" });
    const m = await membre(u.id, institutionOrgId, ROLES_INST);
    if (!m) return json(res, 403, { erreur: "role", message: "Rôle institution requis pour émettre une recommandation." });

    const cli = client();
    const ins = await cli.from("recommendations").insert({
      pme_org_id: pmeOrgId, institution_org_id: institutionOrgId, assessment_id: assessmentId || null,
      author_user: u.id, title, body: body || null, actions: actions || null, level: level || null,
    }).select("id, sent_at").single();
    if (ins.error) return json(res, 500, { erreur: "ecriture", message: ins.error.message });
    await cli.from("recommendation_events").insert({ recommendation_id: ins.data.id, actor_user: u.id, event: "sent" });
    await journaliser(req, { actorUser: u.id, actorOrg: institutionOrgId, action: "recommendation.send", targetOrg: pmeOrgId, targetType: "recommendation", targetId: ins.data.id });
    return json(res, 200, { id: ins.data.id, sent_at: ins.data.sent_at });
  }

  return json(res, 405, { erreur: "methode" });
}
