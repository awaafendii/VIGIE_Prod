/* ============================================================
   VIGIE — adaptateur CinetPay (agrégateur de paiement UEMOA)
   ------------------------------------------------------------
   Modèle CinetPay (différent de l'open banking OAuth) :
   • Authentification serveur par apikey + site_id (jamais exposés au front).
   • Pas de redirection OAuth de l'utilisateur : la « source » est le compte
     marchand configuré côté serveur.
   • CinetPay n'offre pas d'API propre de LISTE de transactions : l'historique
     vit dans le back-office. La reconstitution fiable pour le rapprochement se
     fait donc par WEBHOOK (notify) → vérification → stockage, puis lecture du
     stock par mois. Voir api/banque/notify.js et api/_lib/magasin.js.

   Réf : https://docs.cinetpay.com/api/1.0-fr/checkout/verification
   ============================================================ */

export class MagasinNonConfigure extends Error {
  constructor(msg) { super(msg); this.name = "MagasinNonConfigure"; this.code = "magasin"; }
}

// Associe un moyen de paiement CinetPay à un canal lisible pour VIGIE.
export function canalDepuisMethode(m = "") {
  const s = String(m).toUpperCase();
  if (s.includes("WAVE")) return "Wave";
  if (s.includes("OM") || s.includes("ORANGE")) return "Orange Money";
  if (s.includes("MOMO") || s.includes("MTN")) return "MTN MoMo";
  if (s.includes("FLOOZ") || s.includes("MOOV")) return "Moov Money";
  if (s.includes("FREE") || s.includes("WIZALL")) return "Free Money";
  if (s.includes("CARD") || s.includes("VISA") || s.includes("MASTER")) return "Carte";
  return "Mobile money";
}

/* Vérifie une transaction auprès de CinetPay (source de vérité).
   Renvoie { statut, tx } où tx est au format VIGIE {date,montant,canal,libelle,frais}
   (ou tx=null si non abouti / non trouvé). */
export async function verifierTransaction({ cfg, transactionId }) {
  const rep = await fetch(`${cfg.base}/v2/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apikey: cfg.apikey, site_id: cfg.siteId, transaction_id: transactionId }),
  });
  const d = await rep.json().catch(() => ({}));
  const data = d.data || {};
  const statut = String(data.status || d.message || "").toUpperCase();
  const abouti = statut === "ACCEPTED";
  const montant = Math.round(Number(data.amount || 0));
  const tx = abouti && montant > 0 ? {
    id: String(transactionId),
    date: String(data.payment_date || "").slice(0, 10),
    montant,
    canal: canalDepuisMethode(data.payment_method),
    libelle: String(data.description || data.operator_id || "Encaissement").slice(0, 140),
    frais: 0,
    devise: data.currency || "XOF",
  } : null;
  return { statut, tx };
}

/* Transactions d'un mois (YYYY-MM) au format VIGIE, lues depuis le stock
   alimenté par le webhook notify. Nécessite un magasin (Vercel KV ou autre).
   À défaut de magasin, lève MagasinNonConfigure (aucune donnée inventée). */
export async function recupererTransactions({ mois, magasin }) {
  if (!magasin) {
    throw new MagasinNonConfigure(
      "Aucun magasin de transactions n'est configuré. Activez Vercel KV (voir api/_lib/magasin.js) " +
      "pour que le webhook CinetPay (api/banque/notify.js) enregistre les paiements à rapprocher."
    );
  }
  const liste = await magasin.listerMois(mois);
  return (Array.isArray(liste) ? liste : [])
    .filter((t) => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number(t.montant) > 0)
    .map((t) => ({ date: t.date, montant: Math.round(Number(t.montant)), canal: t.canal || "Mobile money", libelle: t.libelle || "Encaissement", frais: Math.round(Number(t.frais || 0)) || 0 }));
}
