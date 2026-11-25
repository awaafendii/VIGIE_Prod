/* /api/data/transactions — lecture des transactions persistées (Phase 2)
   ------------------------------------------------------------
   GET ?orgId=&mois=AAAA-MM : transactions normalisées de la PME, filtrées
   par mois (optionnel). RLS appliquée (client au nom de l'utilisateur).

   Distinct de /api/banque/transactions : celui-ci lit la table Postgres
   app.transactions (toutes sources), pas le flux CinetPay stocké en KV.
   ============================================================ */
import { json } from "../_lib/securite.js";
import { configured } from "../_lib/db.js";
import { utilisateur, membre, clientUtilisateur } from "../_lib/auth.js";

const moisSuivant = (mois) => { const [y, m] = mois.split("-").map(Number); const t = y * 12 + (m - 1) + 1; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`; };

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { erreur: "methode" });
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  const u = await utilisateur(req);
  if (!u) return json(res, 401, { erreur: "auth" });

  const url = new URL(req.url, "http://x");
  const orgId = url.searchParams.get("orgId");
  const mois = url.searchParams.get("mois");
  if (!orgId) return json(res, 400, { erreur: "orgId" });
  if (!(await membre(u.id, orgId))) return json(res, 403, { erreur: "acces" });

  const cli = clientUtilisateur(u);
  let q = cli.from("transactions")
    .select("id, source, dir, occurred_on, amount, canal, tiers, libelle, status")
    .eq("org_id", orgId);
  if (mois && /^\d{4}-\d{2}$/.test(mois)) q = q.gte("occurred_on", `${mois}-01`).lt("occurred_on", moisSuivant(mois));
  const { data, error } = await q.order("occurred_on", { ascending: true });
  if (error) return json(res, 500, { erreur: "lecture", message: error.message });

  // forme attendue par analyse.js côté front
  const transactions = (data || []).map((t) => ({ sens: t.dir, date: t.occurred_on, montant: Number(t.amount), canal: t.canal || "Autre", statut: t.status || "Payé", tiers: t.tiers || "—", libelle: t.libelle || "", ref: t.id }));
  return json(res, 200, { transactions });
}
