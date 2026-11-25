/* /api/institution/pme — détail d'une PME vu par une institution (Phase 3)
   ------------------------------------------------------------
   GET ?institutionOrgId=&pmeOrgId= : historique des évaluations + indicateurs
   d'une PME, UNIQUEMENT si cette PME a accordé à l'institution un consentement
   actif couvrant 'assessments'.

   C'est le « véritable contrôle d'autorisation » que l'audit signalait absent :
     identité → membre de l'institution → consentement ACTIF de la PME.
   Sans consentement : 403, même si l'utilisateur est une institution valide.
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre, journaliser } from "../_lib/auth.js";
import { client, grantActif } from "../_lib/consent.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { erreur: "methode" });
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  const url = new URL(req.url, "http://x");
  const institutionOrgId = url.searchParams.get("institutionOrgId");
  const pmeOrgId = url.searchParams.get("pmeOrgId");
  if (!institutionOrgId || !pmeOrgId) return json(res, 400, { erreur: "params" });
  if (!(await membre(u.id, institutionOrgId))) return json(res, 403, { erreur: "acces" });

  const cli = client();
  const grant = await grantActif(cli, pmeOrgId, institutionOrgId, "assessments");
  if (!grant) return json(res, 403, { erreur: "consentement", message: "Aucun consentement actif de cette PME pour cette institution." });

  const ev = await cli
    .from("credit_assessments")
    .select("id, score, etat, period_start, period_end, computed_at, model_version_id, snapshot")
    .eq("org_id", pmeOrgId)
    .order("computed_at", { ascending: false });
  if (ev.error) return json(res, 500, { erreur: "lecture", message: ev.error.message });

  const dernier = ev.data?.[0] || null;
  let indicateurs = [];
  if (dernier) {
    const ri = await cli.from("risk_indicators").select("name, value").eq("assessment_id", dernier.id);
    indicateurs = ri.data || [];
  }

  await journaliser(req, { actorUser: u.id, actorOrg: institutionOrgId, action: "pme.consult", targetOrg: pmeOrgId, targetType: "credit_assessment", targetId: dernier?.id, scope: "assessments" });
  return json(res, 200, { evaluations: ev.data || [], indicateurs });
}
