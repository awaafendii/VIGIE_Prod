/* ============================================================
   VIGIE — client des alertes précoces (navigateur, Phase 4)
   ------------------------------------------------------------
   Fine couche au-dessus de fetchAuth (JWT Bearer). En mode démo l'app
   n'appelle pas ces fonctions. La portée (membre PME ou institution
   consentie) est contrôlée côté serveur / RLS.
   ============================================================ */
import { fetchAuth } from "./auth.js";

async function lire(rep) {
  let j = null;
  try { j = await rep.json(); } catch { /* corps vide */ }
  if (!rep.ok) { const e = new Error(j?.message || j?.erreur || `HTTP ${rep.status}`); e.code = j?.erreur || String(rep.status); throw e; }
  return j;
}

export async function listerAlertes(orgId, ouvertes = false) {
  const q = new URLSearchParams({ orgId }); if (ouvertes) q.set("ouvertes", "1");
  return lire(await fetchAuth(`/api/alerts?${q.toString()}`)); // { alertes: [...] }
}

export async function acquitterAlerte({ orgId, alertId }) {
  return lire(await fetchAuth("/api/alerts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ack", orgId, alertId }),
  })); // { alerte }
}
