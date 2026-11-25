/* /api/institution/portfolio — portefeuille RÉEL d'une institution (Phase 3)
   ------------------------------------------------------------
   GET ?institutionOrgId= : liste les PME qui ont accordé à CETTE institution
   un consentement actif couvrant 'assessments', avec la dernière évaluation
   de chacune. Remplace le portefeuille synthétique (genererPortefeuille),
   qui reste réservé à la démonstration.

   Autorisation : identité → l'utilisateur est membre de l'institution →
   seules les PME ayant un consentement ACTIF, NON EXPIRÉ sont renvoyées.
   Aucune donnée d'une PME n'est exposée sans son consentement explicite.
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre } from "../_lib/auth.js";
import { client } from "../_lib/consent.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { erreur: "methode" });
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  const institutionOrgId = new URL(req.url, "http://x").searchParams.get("institutionOrgId");
  if (!institutionOrgId) return json(res, 400, { erreur: "institutionOrgId" });
  if (!(await membre(u.id, institutionOrgId))) return json(res, 403, { erreur: "acces" });

  const cli = client(); // admin : on filtre nous-mêmes sur les consentements actifs
  const maintenant = new Date().toISOString();
  const g = await cli
    .from("data_access_grants")
    .select("pme_org_id, scopes, expires_at, granted_at, organizations:pme_org_id (id, name)")
    .eq("institution_org_id", institutionOrgId)
    .eq("status", "active")
    .contains("scopes", ["assessments"]);
  if (g.error) return json(res, 500, { erreur: "lecture", message: g.error.message });

  const actifs = (g.data || []).filter((x) => !x.expires_at || x.expires_at > maintenant);
  const pme = [];
  for (const row of actifs) {
    const a = await cli
      .from("credit_assessments")
      .select("id, score, etat, period_start, period_end, computed_at, snapshot")
      .eq("org_id", row.pme_org_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const al = await cli
      .from("credit_alerts")
      .select("id, kind, severity, message, created_at")
      .eq("org_id", row.pme_org_id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    pme.push({
      pmeOrgId: row.pme_org_id,
      nom: row.organizations?.name || "PME",
      scopes: row.scopes,
      depuis: row.granted_at,
      expire: row.expires_at || null,
      evaluation: a.data || null, // null : partage accordé mais pas encore d'évaluation
      alerte: al.data || null,    // alerte précoce ouverte la plus récente, le cas échéant
    });
  }
  return json(res, 200, { portefeuille: pme });
}
