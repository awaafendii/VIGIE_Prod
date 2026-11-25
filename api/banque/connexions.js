/* GET    /api/banque/connexions                → { connexions: [] }   (200 si le serveur est configuré)
   DELETE /api/banque/connexions?fournisseur=X   → { ok: true }
   Avec CinetPay, la source est le compte marchand configuré côté serveur : il n'y
   a pas de consentement par utilisateur à lister. Un GET 200 signale au front que
   la connexion est disponible ; l'état « synchronisé » est marqué côté client
   après une récupération réussie. */
import { config, json, nonConfigure, origineAutorisee, FOURNISSEURS } from "../_lib/securite.js";

export default async function handler(req, res) {
  const cfg = config();
  if (!cfg) return nonConfigure(res);

  if (req.method === "GET") return json(res, 200, { connexions: [] });

  if (req.method === "DELETE") {
    if (!origineAutorisee(req)) return json(res, 403, { erreur: "origine", message: "Origine non autorisée." });
    const url = new URL(req.url, `https://${req.headers["x-forwarded-host"] || req.headers.host}`);
    const fournisseur = url.searchParams.get("fournisseur");
    if (!FOURNISSEURS.has(fournisseur)) return json(res, 400, { erreur: "fournisseur", message: "Fournisseur inconnu." });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { erreur: "methode", message: `Méthode ${req.method} non autorisée.` });
}
