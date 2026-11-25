/* GET /api/banque/transactions?fournisseur=X&mois=YYYY-MM → { transactions:[...] }
   Lit les encaissements CinetPay du mois depuis le stock alimenté par le webhook. */
import { config, methode, json, nonConfigure, FOURNISSEURS } from "../_lib/securite.js";
import { recupererTransactions } from "../_lib/agregateur.js";
import { obtenirMagasin } from "../_lib/magasin.js";

export default async function handler(req, res) {
  if (!methode(req, res, "GET")) return;
  const cfg = config();
  if (!cfg) return nonConfigure(res);

  const url = new URL(req.url, `https://${req.headers["x-forwarded-host"] || req.headers.host}`);
  const fournisseur = url.searchParams.get("fournisseur");
  const mois = url.searchParams.get("mois");
  if (!FOURNISSEURS.has(fournisseur)) return json(res, 400, { erreur: "fournisseur", message: "Fournisseur inconnu." });
  if (mois && !/^\d{4}-\d{2}$/.test(mois)) return json(res, 400, { erreur: "mois", message: "Mois invalide (attendu AAAA-MM)." });

  try {
    const magasin = await obtenirMagasin();
    const toutes = await recupererTransactions({ mois, magasin });
    // Filtre par canal du fournisseur demandé (ex. « Wave », « Orange Money »).
    const f = { openbanking: null, orange: "Orange Money", wave: "Wave", mtn: "MTN MoMo", moov: "Moov Money", free: "Free Money" }[fournisseur];
    const transactions = f ? toutes.filter((t) => t.canal === f) : toutes;
    return json(res, 200, { transactions });
  } catch (e) {
    const code = e.code || "erreur";
    // Magasin absent : on le signale comme "non configuré" côté UI (aucune donnée inventée).
    if (code === "magasin") return nonConfigure(res);
    return json(res, 502, { erreur: code, message: e.message || "Lecture des transactions impossible." });
  }
}
