/* /api/imports — persistance des imports financiers (Phase 2)
   ------------------------------------------------------------
   POST : enregistre un import validé (opérations déjà normalisées par
          analyse.js côté navigateur en prévisualisation), de façon
          idempotente, puis recalcule et historise l'évaluation OFFICIELLE
          côté serveur. Rôles requis : owner | finance_manager | accountant.
   GET ?orgId= : liste les lots d'import de la PME (RLS appliquée).

   Authentification par JWT (en-tête Bearer) : pas de cookie auto-envoyé,
   donc pas de vecteur CSRF ici. Non configuré → 501 (mode démo intact).
   ============================================================ */
import { json } from "./_lib/securite.js";
import { configured } from "./_lib/db.js";
import { utilisateur, membre, journaliser, clientUtilisateur } from "./_lib/auth.js";
import { client, peutEcrire, persistImport, evaluerEtHistoriser } from "./_lib/finance.js";

async function corps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let b = ""; for await (const m of req) { b += m; if (b.length > 5_000_000) break; }
  try { return b ? JSON.parse(b) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  if (!configured()) return json(res, 501, { erreur: "non_configure", message: "Persistance non configurée." });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  if (req.method === "GET") {
    const orgId = new URL(req.url, "http://x").searchParams.get("orgId");
    if (!orgId) return json(res, 400, { erreur: "orgId" });
    if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" });
    const cli = clientUtilisateur(u);
    const { data, error } = await cli.from("import_batches")
      .select("id, filename, period_start, period_end, rows_total, rows_accepted, rows_rejected, created_at")
      .eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) return json(res, 500, { erreur: "lecture", message: error.message });
    return json(res, 200, { batches: data });
  }

  if (req.method === "POST") {
    const b = await corps(req);
    const { orgId, filename, fileHash, operations, periodStart, periodEnd } = b;
    if (!orgId || !fileHash || !Array.isArray(operations)) return json(res, 400, { erreur: "payload" });
    const m = await membre(u.id, orgId);
    if (!m) return json(res, 403, { erreur: "acces" });
    if (!peutEcrire(m.role)) return json(res, 403, { erreur: "role", message: "Rôle insuffisant pour importer." });

    const ops = operations
      .filter((o) => o && (o.sens === "ENTREE" || o.sens === "SORTIE") && /^\d{4}-\d{2}-\d{2}$/.test(o.date || "") && Number(o.montant) > 0)
      .map((o) => ({ sens: o.sens, date: o.date, montant: Number(o.montant), canal: o.canal, statut: o.statut, tiers: o.tiers, libelle: o.libelle }));
    if (!ops.length) return json(res, 400, { erreur: "operations_vides" });

    const cli = client();
    const r = await persistImport(cli, { orgId, uploadedBy: u.id, filename, fileHash, operations: ops, periodStart, periodEnd });
    const assessment = r.deja ? null : await evaluerEtHistoriser(cli, { orgId, batchId: r.batchId, computedBy: u.id });
    await journaliser(req, { actorUser: u.id, actorOrg: orgId, action: "import.persist", targetOrg: orgId, targetType: "import_batch", targetId: r.batchId, payload: { accepted: r.accepted, duplicates: r.duplicates, deja: r.deja } });
    return json(res, 200, { ...r, assessment });
  }

  return json(res, 405, { erreur: "methode" });
}
