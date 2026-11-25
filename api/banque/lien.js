/* POST /api/banque/lien  { fournisseur } → { mode: "direct" }
   CinetPay ne demande pas de redirection OAuth de l'utilisateur : le compte
   marchand est configuré côté serveur. On confirme simplement que la source est
   disponible ; le front enchaîne alors sur une synchronisation. */
import { config, methode, origineAutorisee, corpsJson, json, nonConfigure, FOURNISSEURS } from "../_lib/securite.js";

export default async function handler(req, res) {
  if (!methode(req, res, "POST")) return;
  const cfg = config();
  if (!cfg) return nonConfigure(res);
  if (!origineAutorisee(req)) return json(res, 403, { erreur: "origine", message: "Origine non autorisée." });

  const { fournisseur } = await corpsJson(req);
  if (!FOURNISSEURS.has(fournisseur)) return json(res, 400, { erreur: "fournisseur", message: "Fournisseur inconnu." });

  // Pas d'étape de consentement à faire traverser à l'utilisateur.
  return json(res, 200, { mode: "direct" });
}
