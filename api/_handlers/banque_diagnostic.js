/* /api/banque/diagnostic — outil de validation du flux (sandbox)
   ------------------------------------------------------------
   DÉSACTIVÉ par défaut. Ne s'active que si la variable d'environnement
   SANDBOX_TOKEN est définie, ET si la requête envoie l'en-tête
   `x-sandbox-token` correspondant. Sinon → 404 (on ne révèle rien).

   • GET    : état de configuration (booléens, AUCUN secret) + test d'écriture KV.
   • POST   : injecte une transaction de TEST (id préfixé « TEST- ») pour voir le
              rapprochement de bout en bout sans vrai paiement CinetPay.
              body JSON facultatif : { montant, canal, libelle, date, mois }
   • DELETE : supprime les transactions de TEST du mois ( ?mois=AAAA-MM ).

   À n'utiliser qu'en recette. Laissez SANDBOX_TOKEN vide en production.
   ============================================================ */
import crypto from "node:crypto";
import { config, json } from "../_lib/securite.js";
import { obtenirMagasin } from "../_lib/magasin.js";
import { canalDepuisMethode } from "../_lib/agregateur.js";

function jetonValide(req) {
  const attendu = process.env.SANDBOX_TOKEN || "";
  if (!attendu) return false; // fonctionnalité éteinte
  const fourni = req.headers["x-sandbox-token"] || "";
  const a = Buffer.from(String(fourni)), b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function corps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let brut = ""; for await (const m of req) { brut += m; if (brut.length > 20000) break; }
  try { return brut ? JSON.parse(brut) : {}; } catch { return {}; }
}

const moisCourant = () => new Date().toISOString().slice(0, 7);

export default async function handler(req, res) {
  if (!jetonValide(req)) return json(res, 404, { erreur: "introuvable" }); // off ou mauvais jeton
  const cfg = config();
  const magasin = await obtenirMagasin();

  if (req.method === "GET") {
    let kvRoundtrip = false;
    if (magasin) {
      try {
        const sonde = { id: `TEST-SONDE-${Date.now()}`, date: `${moisCourant()}-01`, montant: 1, canal: "Wave", libelle: "sonde KV", frais: 0 };
        await magasin.enregistrer(sonde);
        const lu = await magasin.listerMois(moisCourant());
        kvRoundtrip = lu.some((t) => t.id === sonde.id);
        await magasin.supprimer(moisCourant(), [sonde.id]);
      } catch { kvRoundtrip = false; }
    }
    return json(res, 200, {
      configure: !!cfg,
      apikeyPresent: !!process.env.CINETPAY_APIKEY,
      siteIdPresent: !!process.env.CINETPAY_SITE_ID,
      appOriginPresent: !!process.env.APP_ORIGIN,
      magasin: magasin ? "kv" : "absent",
      kvRoundtrip,
      mois: moisCourant(),
    });
  }

  if (req.method === "POST") {
    if (!magasin) return json(res, 503, { erreur: "magasin", message: "Vercel KV non configuré : impossible d'injecter une transaction de test." });
    const b = await corps(req);
    const mois = /^\d{4}-\d{2}$/.test(b.mois || "") ? b.mois : moisCourant();
    const jour = String(b.date || "").match(/^\d{4}-\d{2}-\d{2}$/) ? b.date : `${mois}-15`;
    const tx = {
      id: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: jour,
      montant: Math.max(1, Math.round(Number(b.montant) || 150000)),
      canal: b.canal || canalDepuisMethode(b.methode || "WAVE"),
      libelle: String(b.libelle || "Encaissement de test").slice(0, 140),
      frais: Math.round(Number(b.frais) || 0),
    };
    await magasin.enregistrer(tx);
    const total = (await magasin.listerMois(mois)).length;
    return json(res, 200, { ok: true, tx, moisCount: total, mois });
  }

  if (req.method === "DELETE") {
    if (!magasin) return json(res, 200, { ok: true, supprimees: 0 });
    const url = new URL(req.url, `https://${req.headers["x-forwarded-host"] || req.headers.host}`);
    const mois = /^\d{4}-\d{2}$/.test(url.searchParams.get("mois") || "") ? url.searchParams.get("mois") : moisCourant();
    try {
      const ids = (await magasin.listerMois(mois)).map((t) => t.id).filter((id) => String(id).startsWith("TEST-"));
      const n = ids.length ? await magasin.supprimer(mois, ids) : 0;
      return json(res, 200, { ok: true, supprimees: n, mois });
    } catch (e) {
      return json(res, 500, { erreur: "erreur", message: e.message });
    }
  }

  return json(res, 405, { erreur: "methode" });
}
