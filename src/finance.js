/* ============================================================
   VIGIE — client de persistance financière (navigateur)
   ------------------------------------------------------------
   Fine couche au-dessus de fetchAuth (JWT en en-tête Bearer).
   Utilisée quand l'authentification est active ; en mode démo
   (authDisponible = false) l'application n'appelle pas ces fonctions.

   Le navigateur n'envoie que des opérations DÉJÀ normalisées par
   analyse.js (prévisualisation) ; le serveur valide, déduplique,
   persiste et recalcule l'évaluation officielle.
   ============================================================ */
import { fetchAuth } from "./auth.js";

async function lire(rep) {
  let j = null;
  try { j = await rep.json(); } catch { /* corps vide */ }
  if (!rep.ok) { const e = new Error(j?.message || j?.erreur || `HTTP ${rep.status}`); e.code = j?.erreur || String(rep.status); throw e; }
  return j;
}

// Empreinte SHA-256 du fichier → idempotence serveur (double import bloqué).
export async function empreinteFichier(fileOuBuffer) {
  const buf = fileOuBuffer instanceof ArrayBuffer ? fileOuBuffer : await fileOuBuffer.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function enregistrerImport({ orgId, filename, fileHash, operations, periodStart, periodEnd }) {
  const rep = await fetchAuth("/api/imports", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, filename, fileHash, operations, periodStart, periodEnd }),
  });
  return lire(rep); // { deja, batchId, accepted, duplicates, assessment }
}

export async function listerImports(orgId) {
  return lire(await fetchAuth(`/api/imports?orgId=${encodeURIComponent(orgId)}`));
}

export async function lireTransactions(orgId, mois) {
  const q = new URLSearchParams({ orgId }); if (mois) q.set("mois", mois);
  return lire(await fetchAuth(`/api/data/transactions?${q.toString()}`)); // { transactions: [...] }
}

export async function historiqueEvaluations(orgId) {
  return lire(await fetchAuth(`/api/assessments?orgId=${encodeURIComponent(orgId)}`)); // { assessments: [...] }
}

export async function recalculerEvaluation(orgId) {
  return lire(await fetchAuth("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId }) }));
}

export async function listerRecommandations(orgId) {
  return lire(await fetchAuth(`/api/recommendations?orgId=${encodeURIComponent(orgId)}`));
}

export async function envoyerRecommandation(payload) {
  return lire(await fetchAuth("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
}
