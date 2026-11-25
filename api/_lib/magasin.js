/* ============================================================
   VIGIE — magasin des transactions reçues par webhook
   ------------------------------------------------------------
   CinetPay n'expose pas d'API de liste : on enregistre chaque paiement
   vérifié (via le webhook notify) pour pouvoir le rapprocher ensuite.

   Implémentation par défaut : Vercel KV (si configuré).
     1) `npm i @vercel/kv`
     2) Créer un store KV dans Vercel et le lier au projet
        (variables KV_REST_API_URL / KV_REST_API_TOKEN injectées automatiquement).
   Si KV n'est pas configuré, obtenirMagasin() renvoie null et l'application
   affiche « connexion non activée » plutôt que d'inventer des données.

   Pour un autre stockage (Postgres, Mongo…), ré-implémentez enregistrer()
   et listerMois() en gardant la même interface.
   ============================================================ */

const cle = (mois) => `vigie:tx:${mois}`; // un hash par mois : { [transactionId]: txJSON }

export async function obtenirMagasin() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  let kv;
  try { ({ kv } = await import("@vercel/kv")); }
  catch { return null; } // paquet non installé
  if (!kv) return null;

  return {
    // tx = { id, date:"YYYY-MM-DD", montant, canal, libelle, frais }
    async enregistrer(tx) {
      if (!tx || !tx.id || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date || "")) return;
      const mois = tx.date.slice(0, 7);
      await kv.hset(cle(mois), { [tx.id]: JSON.stringify(tx) }); // idempotent : même id → écrase
      await kv.expire(cle(mois), 60 * 60 * 24 * 400); // rétention ~13 mois
    },
    async listerMois(mois) {
      if (!/^\d{4}-\d{2}$/.test(mois || "")) return [];
      const h = (await kv.hgetall(cle(mois))) || {};
      return Object.values(h).map((v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } }).filter(Boolean);
    },
    async supprimer(mois, ids = []) {
      if (!/^\d{4}-\d{2}$/.test(mois || "") || !ids.length) return 0;
      await kv.hdel(cle(mois), ...ids);
      return ids.length;
    },
  };
}
