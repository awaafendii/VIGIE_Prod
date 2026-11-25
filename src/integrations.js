/* ============================================================
   VIGIE — client des connecteurs marchand (navigateur, Phase 4)
   ------------------------------------------------------------
   Fine couche au-dessus de fetchAuth (JWT Bearer). En mode démo l'app
   n'appelle pas ces fonctions.

   La clé marchand (apikey CinetPay) est un SECRET : elle transite une seule
   fois vers le serveur (HTTPS) à l'enregistrement, y est chiffrée au repos,
   et n'est JAMAIS renvoyée ni stockée côté navigateur.
   ============================================================ */
import { fetchAuth } from "./auth.js";

async function lire(rep) {
  let j = null;
  try { j = await rep.json(); } catch { /* corps vide */ }
  if (!rep.ok) { const e = new Error(j?.message || j?.erreur || `HTTP ${rep.status}`); e.code = j?.erreur || String(rep.status); throw e; }
  return j;
}

export async function listerIntegrations(orgId) {
  return lire(await fetchAuth(`/api/integrations?orgId=${encodeURIComponent(orgId)}`)); // { integrations: [...] } (sans secret)
}

export async function enregistrerIntegration({ orgId, externalSiteId, apikey, base }) {
  return lire(await fetchAuth("/api/integrations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", orgId, externalSiteId, apikey, base }),
  })); // { integration } (sans secret)
}

export async function revoquerIntegration({ orgId, integrationId }) {
  return lire(await fetchAuth("/api/integrations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "revoke", orgId, integrationId }),
  })); // { integration }
}
