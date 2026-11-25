/* ============================================================
   VIGIE — persistance financière (serveur)
   ------------------------------------------------------------
   • Enregistre un import de façon IDEMPOTENTE :
       - un fichier déjà importé (même file_hash) n'est pas rejoué ;
       - une ligne déjà présente (org_id, source, source_ref) n'est
         pas dupliquée.
   • Recalcule l'ÉVALUATION OFFICIELLE côté serveur à partir des
     transactions persistées (réutilise analyse.js, moteur pur), et
     l'historise avec sa version de modèle et un instantané.
   Toutes les écritures passent par la clé service_role (admin), après
   vérification d'identité + rôle faite dans les routes.
   ============================================================ */
import crypto from "node:crypto";
import { admin } from "./db.js";

export const MODELE_VERSION = "analyse.js@1";
const ROLES_ECRITURE = ["owner", "finance_manager", "accountant"];
export const peutEcrire = (role) => ROLES_ECRITURE.includes(role);

const norm = (s) => String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ");

// Référence stable d'une ligne importée → idempotence (même fichier réimporté = mêmes refs).
function refImport(orgId, op, idx) {
  const base = `${orgId}|${op.date}|${op.sens}|${op.montant}|${norm(op.tiers)}|${norm(op.libelle)}|${idx}`;
  return "imp_" + crypto.createHash("sha1").update(base).digest("hex").slice(0, 24);
}

// Transforme les transactions stockées en la forme attendue par analyse.js.
function versFormeAnalyse(rows) {
  const E = [], S = [];
  for (const t of rows) {
    const op = { sens: t.dir, date: t.occurred_on, montant: Number(t.amount), canal: t.canal || "Autre", statut: t.status || "Payé", tiers: t.tiers || "—", libelle: t.libelle || "", ref: t.source_ref };
    (t.dir === "ENTREE" ? E : S).push(op);
  }
  return { E, S };
}

// Enregistre un lot d'import + ses transactions. operations = sortie normalisée d'analyse.js.
export async function persistImport(cli, { orgId, uploadedBy, filename, fileHash, operations, periodStart, periodEnd, engineVersion }) {
  // 1) lot d'import (bloque le double import du même fichier)
  let batch;
  const ins = await cli.from("import_batches").insert({
    org_id: orgId, uploaded_by: uploadedBy, filename, file_hash: fileHash,
    period_start: periodStart || null, period_end: periodEnd || null,
    engine_version: engineVersion || MODELE_VERSION, rows_total: operations.length,
  }).select("id").single();
  if (ins.error) {
    if (ins.error.code === "23505") { // file_hash déjà présent
      const ex = await cli.from("import_batches").select("id").eq("org_id", orgId).eq("file_hash", fileHash).maybeSingle();
      return { deja: true, batchId: ex.data?.id || null, accepted: 0, duplicates: operations.length };
    }
    throw new Error(ins.error.message);
  }
  batch = ins.data;

  // 2) transactions normalisées (upsert idempotent)
  const rows = operations.map((op, i) => ({
    org_id: orgId, source: "import", source_ref: refImport(orgId, op, i),
    dir: op.sens, occurred_on: op.date, amount: op.montant,
    canal: op.canal || null, tiers: op.tiers && op.tiers !== "—" ? op.tiers : null,
    libelle: op.libelle || null, status: op.statut || "Payé", batch_id: batch.id,
  }));
  const up = await cli.from("transactions").upsert(rows, { onConflict: "org_id,source,source_ref", ignoreDuplicates: true }).select("id");
  if (up.error) throw new Error(up.error.message);
  const accepted = up.data?.length || 0;

  // 3) lignes brutes (traçabilité)
  await cli.from("raw_transactions").insert(operations.map((op, i) => ({ batch_id: batch.id, org_id: orgId, line_no: i + 1, payload: op })));
  await cli.from("import_batches").update({ rows_accepted: accepted, rows_rejected: operations.length - accepted }).eq("id", batch.id);

  return { deja: false, batchId: batch.id, accepted, duplicates: operations.length - accepted };
}

// Construit une alerte précoce si le risque se dégrade entre deux évaluations.
// Retourne les champs d'alerte, ou null si pas de dégradation significative.
const RANG_ETAT = { "Sain": 0, "Vigilance": 1, "Alerte précoce": 2 };
const SEUIL_CHUTE_SCORE = 10; // points
export function construireAlerte(prec, courant) {
  if (!prec) return null; // première évaluation : rien à comparer
  const rp = RANG_ETAT[prec.etat] ?? 0, rc = RANG_ETAT[courant.etat] ?? 0;
  const chute = (prec.score ?? 0) - (courant.score ?? 0); // positif = dégradation
  const etatPire = rc > rp;
  if (!etatPire && chute < SEUIL_CHUTE_SCORE) return null;
  const severity = courant.etat === "Alerte précoce" ? "haute" : etatPire ? "moyenne" : "faible";
  return {
    kind: etatPire ? "etat" : "score", severity,
    from_score: prec.score ?? null, to_score: courant.score ?? null,
    from_etat: prec.etat || null, to_etat: courant.etat || null, delta: -chute,
    message: etatPire
      ? `Dégradation du risque : passage de « ${prec.etat} » à « ${courant.etat} ».`
      : `Baisse du score : ${prec.score} → ${courant.score} (−${chute} points).`,
  };
}

// Recalcule et historise l'évaluation officielle d'une PME à partir de ses transactions persistées.
export async function evaluerEtHistoriser(cli, { orgId, batchId, computedBy }) {
  const tx = await cli.from("transactions").select("dir, occurred_on, amount, canal, status, tiers, libelle, source_ref").eq("org_id", orgId);
  if (tx.error) throw new Error(tx.error.message);
  if (!tx.data?.length) return null;

  // Évaluation précédente (pour détecter une dégradation = alerte précoce).
  const prec = await cli.from("credit_assessments").select("id, score, etat").eq("org_id", orgId).order("computed_at", { ascending: false }).limit(1).maybeSingle();

  const { analyserMois, diagnostiquer, prevoirTresorerie } = await import("../../src/analyse.js");
  const { E, S } = versFormeAnalyse(tx.data);
  const mois = analyserMois(E, S, 0);
  const diag = diagnostiquer(mois);
  if (!diag) return null;
  const prev = prevoirTresorerie(mois, []);
  const der = diag.dernier;

  // version du modèle (référentiel)
  const mv = await cli.from("scoring_model_versions").upsert({ version: MODELE_VERSION }, { onConflict: "version", ignoreDuplicates: false }).select("id").single();
  const modelVersionId = mv.data?.id || null;

  const a = await cli.from("credit_assessments").insert({
    org_id: orgId, model_version_id: modelVersionId, batch_id: batchId || null, computed_by: computedBy || null,
    period_start: mois[0]?.cle ? `${mois[0].cle}-01` : null, period_end: der?.cle ? `${der.cle}-01` : null,
    score: der.score, etat: der.etat, signals: der.signaux,
    snapshot: { profil: der.profil, disponible: der.disponible, joursTreso: der.joursTreso, rupture: prev?.rupture || null, nbMois: mois.length },
  }).select("id, score, etat, computed_at").single();
  if (a.error) throw new Error(a.error.message);

  if (der.signaux?.length) {
    await cli.from("risk_indicators").insert(der.signaux.map((s) => ({ assessment_id: a.data.id, org_id: orgId, name: s.nom, value: s.score })));
  }

  // Alerte précoce : dégradation par rapport à l'évaluation précédente.
  const alerte = construireAlerte(prec.data, { score: der.score, etat: der.etat });
  if (alerte) {
    await cli.from("credit_alerts").insert({ org_id: orgId, assessment_id: a.data.id, previous_assessment_id: prec.data?.id || null, ...alerte });
  }
  return a.data;
}

export const client = () => admin();
