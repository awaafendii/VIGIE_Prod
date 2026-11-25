/* ============================================================
   VIGIE — client du rapprochement des versements (navigateur, Phase 4)
   ------------------------------------------------------------
   Fine couche au-dessus de fetchAuth (JWT Bearer). En mode démo l'app
   n'appelle pas ces fonctions. La portée (membre PME) est contrôlée côté
   serveur / RLS.
   ============================================================ */
import { fetchAuth } from "./auth.js";

async function lire(rep) {
  let j = null;
  try { j = await rep.json(); } catch { /* corps vide */ }
  if (!rep.ok) { const e = new Error(j?.message || j?.erreur || `HTTP ${rep.status}`); e.code = j?.erreur || String(rep.status); throw e; }
  return j;
}

export async function lireRapprochement(orgId, mois) {
  const q = new URLSearchParams({ orgId }); if (mois) q.set("mois", mois);
  return lire(await fetchAuth(`/api/settlements?${q.toString()}`)); // { rapprochement }
}

export async function enregistrerVersement({ orgId, providerRef, netAmount, fees, settledOn, integrationId }) {
  return lire(await fetchAuth("/api/settlements", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "record", orgId, providerRef, netAmount, fees, settledOn, integrationId }),
  })); // { settlement }
}
