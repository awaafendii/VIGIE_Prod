/* ============================================================
   VIGIE — client des consentements de partage (navigateur, Phase 3)
   ------------------------------------------------------------
   Fine couche au-dessus de fetchAuth (JWT Bearer). En mode démo
   (authDisponible = false) l'application n'appelle pas ces fonctions.

   Rappel : le front ne DÉCIDE d'aucun droit. Il propose des actions ;
   le serveur vérifie identité → appartenance → rôle, et une institution
   ne voit une PME que via un consentement actif (contrôlé côté serveur).
   ============================================================ */
import { fetchAuth } from "./auth.js";

export const SCOPES = ["assessments", "transactions", "recommendations"];
export const SCOPE_LABEL = {
  assessments: "Évaluations de crédit",
  transactions: "Transactions",
  recommendations: "Recommandations",
};

async function lire(rep) {
  let j = null;
  try { j = await rep.json(); } catch { /* corps vide */ }
  if (!rep.ok) { const e = new Error(j?.message || j?.erreur || `HTTP ${rep.status}`); e.code = j?.erreur || String(rep.status); throw e; }
  return j;
}

// Annuaire des institutions (pour choisir un destinataire de partage).
export async function listerInstitutions() {
  return lire(await fetchAuth("/api/institutions")); // { institutions: [{id, nom, slug}] }
}

// Consentements où l'org est PME ou institution.
export async function listerAutorisations(orgId) {
  return lire(await fetchAuth(`/api/grants?orgId=${encodeURIComponent(orgId)}`)); // { grants: [...] }
}

// Une PME accorde (ou met à jour) un partage vers une institution.
export async function accorderAcces({ pmeOrgId, institutionOrgId, scopes, expiresAt, note }) {
  return lire(await fetchAuth("/api/grants", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "grant", pmeOrgId, institutionOrgId, scopes, expiresAt, note }),
  })); // { grant }
}

// Une PME révoque un partage qu'elle a accordé.
export async function revoquerAcces({ grantId, pmeOrgId }) {
  return lire(await fetchAuth("/api/grants", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "revoke", grantId, pmeOrgId }),
  })); // { grant }
}

// Portefeuille RÉEL d'une institution : PME ayant consenti + dernière évaluation.
export async function portefeuilleInstitution(institutionOrgId) {
  return lire(await fetchAuth(`/api/institution/portfolio?institutionOrgId=${encodeURIComponent(institutionOrgId)}`)); // { portefeuille: [...] }
}

// Détail d'une PME (évaluations + indicateurs), borné au consentement actif.
export async function pmeAutorisee(institutionOrgId, pmeOrgId) {
  const q = new URLSearchParams({ institutionOrgId, pmeOrgId });
  return lire(await fetchAuth(`/api/institution/pme?${q.toString()}`)); // { evaluations, indicateurs }
}
