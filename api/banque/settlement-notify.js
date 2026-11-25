/* POST /api/banque/settlement-notify — webhook de versements (Phase 4)
   ------------------------------------------------------------
   Reçoit les notifications de REVERSEMENT (settlement) de l'agrégateur /
   de la banque, et les enregistre pour le rapprochement. Symétrique du
   webhook de paiements (api/banque/notify.js).

   Authentification : jeton partagé `SETTLEMENT_WEBHOOK_TOKEN` (serveur
   uniquement), attendu dans l'en-tête `x-settlement-token`. Contrairement
   aux paiements, il n'existe pas ici d'API de VÉRIFICATION côté agrégateur :
   le jeton partagé authentifie donc la source. Sans jeton configuré,
   l'endpoint est DÉSACTIVÉ (404).

   Attribution : le `cpm_site_id` est résolu vers l'organisation propriétaire
   via app.integrations. Un site non rattaché est ignoré — jamais d'attribution
   arbitraire. Idempotent via UNIQUE(org_id, provider_ref).

   NB : le mapping des champs ci-dessous suit un format générique ; adaptez-le
   au payload réel de votre agrégateur si nécessaire.
   ============================================================ */
import crypto from "node:crypto";
import { json } from "../_lib/securite.js";
import { configured, admin } from "../_lib/db.js";
import { resoudreIntegration } from "../_lib/cinetpay.js";
import { persistSettlement } from "../_lib/settlements.js";

async function lireCorps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let brut = ""; for await (const m of req) { brut += m; if (brut.length > 200000) break; }
  if (!brut) return {};
  try { return JSON.parse(brut); } catch { return Object.fromEntries(new URLSearchParams(brut)); }
}

function jetonValide(req) {
  const attendu = process.env.SETTLEMENT_WEBHOOK_TOKEN || "";
  if (!attendu) return null; // désactivé
  const recu = String(req.headers["x-settlement-token"] || "");
  const a = Buffer.from(recu), b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const premier = (obj, cles) => { for (const c of cles) if (obj[c] != null && obj[c] !== "") return obj[c]; return undefined; };

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erreur: "methode" });
  const ok = jetonValide(req);
  if (ok === null) return json(res, 404, { erreur: "desactive" });
  if (!ok) return json(res, 401, { erreur: "jeton" });
  if (!configured()) return json(res, 200, { ok: false }); // base absente : rien à faire

  try {
    const c = await lireCorps(req);
    const siteId = premier(c, ["cpm_site_id", "site_id", "merchant_site_id"]);
    const providerRef = premier(c, ["settlement_id", "transfer_id", "reference", "provider_ref", "id"]);
    const netAmount = Number(premier(c, ["net_amount", "amount_net", "montant_net", "amount", "montant"]) ?? NaN);
    const fees = Number(premier(c, ["fees", "frais", "commission"]) ?? 0);
    const settledOnBrut = premier(c, ["settled_at", "settlement_date", "date", "settled_on"]);
    const settledOn = settledOnBrut ? String(settledOnBrut).slice(0, 10) : null;

    if (!siteId || !providerRef || !(netAmount >= 0)) return json(res, 200, { ok: false, ignore: "payload" });
    if (settledOn && !/^\d{4}-\d{2}-\d{2}$/.test(settledOn)) return json(res, 200, { ok: false, ignore: "date" });

    const integ = await resoudreIntegration(siteId);
    if (!integ) return json(res, 200, { ok: false, ignore: "site_non_rattache" }); // jamais d'attribution arbitraire

    await persistSettlement(admin(), { orgId: integ.orgId, integrationId: integ.integrationId, providerRef, netAmount, fees: Number.isFinite(fees) ? fees : 0, settledOn, raw: c });
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 200, { ok: false }); // ne jamais renvoyer 500 au webhook
  }
}
