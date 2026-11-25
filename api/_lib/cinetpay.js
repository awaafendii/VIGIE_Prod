/* ============================================================
   VIGIE — CinetPay multi-marchand (serveur, Phase 3)
   ------------------------------------------------------------
   Un paiement CinetPay appartient à un COMPTE MARCHAND (cpm_site_id). Pour
   l'attribuer à la bonne PME, on résout ce site via app.integrations
   (provider='cinetpay', external_site_id=<site>). Seul un site EXPLICITEMENT
   rattaché à une organisation est attribué ; tout le reste reste en « holding »
   non attribué (webhook notify). On n'attribue jamais arbitrairement
   l'historique mono-marchand à une PME.
   ============================================================ */
import { admin } from "./db.js";
import { ouvrir, chiffrementDispo } from "./crypto.js";

const BASE_DEFAUT = (process.env.CINETPAY_BASE || "https://api-checkout.cinetpay.com").replace(/\/+$/, "");

// Résout un site marchand ET déchiffre sa clé de vérification (si présente).
// Renvoie { orgId, integrationId, cfg } où cfg = { apikey, siteId, base } ou null
// (intégration sans clé stockée, ou chiffrement indisponible).
export async function resoudreSiteCinetpay(siteId, baseEnv) {
  const cli = admin();
  if (!cli || !siteId) return null;
  const { data, error } = await cli
    .from("integrations")
    .select("id, org_id, status, credentials_sealed")
    .eq("provider", "cinetpay")
    .eq("external_site_id", String(siteId))
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  let cfg = null;
  if (data.credentials_sealed && chiffrementDispo()) {
    try {
      const c = ouvrir(data.credentials_sealed);
      if (c?.apikey) cfg = { apikey: c.apikey, siteId: c.siteId || String(siteId), base: (c.base || baseEnv || BASE_DEFAUT).replace(/\/+$/, "") };
    } catch { cfg = null; } // intégrité/clé invalide : on n'attribue pas un paiement non vérifiable
  }
  return { orgId: data.org_id, integrationId: data.id, cfg };
}

// Site marchand → { integrationId, orgId } de la PME propriétaire, ou null.
export async function resoudreIntegration(siteId) {
  const cli = admin();
  if (!cli || !siteId) return null;
  const { data, error } = await cli
    .from("integrations")
    .select("id, org_id, status")
    .eq("provider", "cinetpay")
    .eq("external_site_id", String(siteId))
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return { integrationId: data.id, orgId: data.org_id };
}

// Persiste un encaissement CinetPay VÉRIFIÉ dans l'organisation propriétaire.
// Encaissement = ENTREE. Idempotent via UNIQUE(org_id, source, source_ref).
export async function persistCinetpayTx({ orgId, integrationId, tx }) {
  const cli = admin();
  if (!cli || !orgId || !tx?.id) return { accepted: 0 };
  if (!(Number(tx.montant) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date || "")) return { accepted: 0 };
  const row = {
    org_id: orgId, source: "cinetpay", source_ref: String(tx.id),
    dir: "ENTREE", occurred_on: tx.date, amount: Number(tx.montant),
    canal: tx.canal || "Mobile money", libelle: tx.libelle || "Encaissement",
    status: "Payé", integration_id: integrationId || null,
  };
  const up = await cli
    .from("transactions")
    .upsert(row, { onConflict: "org_id,source,source_ref", ignoreDuplicates: true })
    .select("id");
  if (up.error) throw new Error(up.error.message);
  return { accepted: up.data?.length || 0 };
}
