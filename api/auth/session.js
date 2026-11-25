/* /api/auth/session — contexte de l'utilisateur authentifié
   ------------------------------------------------------------
   GET : renvoie l'identité et les organisations (avec rôle) de
   l'utilisateur. C'est la SOURCE DE VÉRITÉ des droits — le front
   ne décide rien : il affiche l'espace PME ou institution selon
   les organisations réellement rattachées à l'utilisateur.

   • Backend non configuré (pas de Supabase) → 501 { erreur:"non_configure" } :
     l'application retombe sur son mode démo, inchangé.
   • Pas de jeton / jeton invalide → 401.
   ============================================================ */
import { configured } from "../_lib/db.js";
import { utilisateur, appartenances, journaliser } from "../_lib/auth.js";

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { erreur: "methode" });
  if (!configured()) return json(res, 501, { erreur: "non_configure", message: "Authentification non configurée sur le serveur." });

  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth", message: "Authentification requise." });

  const orgs = await appartenances(u.id);
  await journaliser(req, { actorUser: u.id, action: "auth.session" });

  return json(res, 200, {
    utilisateur: { id: u.id, email: u.email },
    organisations: orgs.map((o) => ({ id: o.orgId, type: o.type, nom: o.nom, role: o.role, demo: o.demo })),
  });
}
