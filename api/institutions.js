/* /api/institutions — annuaire des institutions (Phase 3)
   ------------------------------------------------------------
   GET : liste (id, nom) des organisations de type INSTITUTION, pour qu'une
   PME puisse CHOISIR à qui accorder un partage. Données non sensibles
   (les institutions sont des prêteurs identifiés), mais réservé aux
   utilisateurs authentifiés. On exclut les organisations de démonstration.

   Lecture via admin() : la RLS de `organizations` ne montre à un membre PME
   que ses propres organisations ; l'annuaire doit donc contourner la RLS,
   APRÈS vérification que l'appelant est un utilisateur authentifié.
   ============================================================ */
import { json } from "./_lib/securite.js";
import { configured, admin } from "./_lib/db.js";
import { utilisateur } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { erreur: "methode" });
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  const { data, error } = await admin()
    .from("organizations")
    .select("id, name, slug")
    .eq("type", "INSTITUTION")
    .eq("is_demo", false)
    .order("name", { ascending: true });
  if (error) return json(res, 500, { erreur: "lecture", message: error.message });

  return json(res, 200, { institutions: (data || []).map((o) => ({ id: o.id, nom: o.name, slug: o.slug })) });
}
