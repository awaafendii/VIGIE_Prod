/* POST /api/banque/notify  (webhook CinetPay)
   CinetPay appelle cette URL quand le statut d'un paiement change. Le webhook
   ne fait que SIGNALER : on re-vérifie le paiement auprès de CinetPay (source de
   vérité, via notre apikey serveur) avant d'enregistrer. Un POST falsifié ne peut
   donc pas forger un encaissement. Déclarez cette URL comme `notify_url` à
   l'initialisation de vos paiements CinetPay. */
import { config, json } from "../_lib/securite.js";
import { verifierTransaction } from "../_lib/agregateur.js";
import { obtenirMagasin } from "../_lib/magasin.js";
import { configured } from "../_lib/db.js";
import { resoudreSiteCinetpay, persistCinetpayTx } from "../_lib/cinetpay.js";

async function lireCorps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let brut = "";
  for await (const m of req) { brut += m; if (brut.length > 100000) break; }
  if (!brut) return {};
  try { return JSON.parse(brut); } catch { /* sinon formulaire */ }
  return Object.fromEntries(new URLSearchParams(brut));
}

export default async function handler(req, res) {
  // On répond toujours 200 rapidement : CinetPay ré-essaie sinon.
  if (req.method !== "POST") return json(res, 405, { erreur: "methode" });
  const cfg = config();                         // clé du marchand d'environnement (legacy), ou null
  if (!cfg && !configured()) return json(res, 200, { ok: false }); // ni clé env ni base : rien à faire

  try {
    const corps = await lireCorps(req);
    const transactionId = corps.cpm_trans_id || corps.transaction_id || corps.cpm_trans_id_marchand;
    const siteId = corps.cpm_site_id || corps.site_id;
    if (!transactionId) return json(res, 200, { ok: false });

    /* Multi-marchand : on vérifie un paiement avec la clé DU marchand concerné.
       1) Le site est rattaché à une organisation (app.integrations) et sa clé est
          déchiffrable → on vérifie avec cette clé et on attribue à SON org.
       2) Sinon, repli sur le marchand d'environnement (cfg) UNIQUEMENT si le site
          correspond (ou n'est pas précisé) → encaissement vérifié, non rattaché à
          une org → stock « holding » (KV).
       3) Site non rattaché (ou clé indéchiffrable) et différent de l'environnement
          → ignoré proprement. JAMAIS d'attribution d'un paiement non vérifié. */
    let cfgVerif = null, cible = null;            // cible = { orgId, integrationId } si attribution
    if (configured() && siteId) {
      const site = await resoudreSiteCinetpay(siteId, cfg?.base);
      if (site && site.cfg) { cfgVerif = site.cfg; cible = { orgId: site.orgId, integrationId: site.integrationId }; }
    }
    if (!cfgVerif && cfg && (!siteId || String(siteId) === String(cfg.siteId))) cfgVerif = cfg; // repli env, non rattaché
    if (!cfgVerif) return json(res, 200, { ok: false, ignore: "site_non_verifiable" });

    const { tx } = await verifierTransaction({ cfg: cfgVerif, transactionId });
    if (tx) {
      if (cible) {
        // Encaissement VÉRIFIÉ attribué à l'organisation propriétaire (idempotent).
        try { await persistCinetpayTx({ orgId: cible.orgId, integrationId: cible.integrationId, tx }); }
        catch { /* la persistance ne doit jamais faire échouer le webhook */ }
      } else {
        // Marchand d'environnement non rattaché → stock « holding » (KV), NON attribué à une PME.
        const magasin = await obtenirMagasin();
        if (magasin) await magasin.enregistrer(tx);
      }
    }
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 200, { ok: false }); // ne jamais renvoyer 500 au webhook
  }
}
