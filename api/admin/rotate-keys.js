/* /api/admin/rotate-keys — re-scellement des secrets (Phase 4, opérateur)
   ------------------------------------------------------------
   Re-chiffre tous les secrets `integrations.credentials_sealed` avec la clé
   ACTIVE lorsqu'ils ont été scellés avec une version antérieure. À lancer
   après avoir déployé une nouvelle clé (cf. procédure dans api/_lib/crypto.js).

   Ce n'est pas une opération utilisateur : elle est protégée par un JETON
   D'EXPLOITATION (VIGIE_ROTATE_TOKEN, serveur uniquement), envoyé dans
   l'en-tête `x-rotate-token`. Sans ce jeton configuré, l'endpoint est
   DÉSACTIVÉ (404). Aucun secret n'est jamais renvoyé dans la réponse.
   ============================================================ */
import crypto from "node:crypto";
import { json } from "../_lib/securite.js";
import { configured, admin } from "../_lib/db.js";
import { chiffrementDispo, versionActive, versionDe, ouvrir, sceller } from "../_lib/crypto.js";

function jetonValide(req) {
  const attendu = process.env.VIGIE_ROTATE_TOKEN || "";
  if (!attendu) return null; // endpoint désactivé
  const recu = String(req.headers["x-rotate-token"] || "");
  const a = Buffer.from(recu), b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erreur: "methode" });
  const ok = jetonValide(req);
  if (ok === null) return json(res, 404, { erreur: "desactive" });  // VIGIE_ROTATE_TOKEN absent
  if (!ok) return json(res, 401, { erreur: "jeton" });
  if (!configured()) return json(res, 501, { erreur: "non_configure" });
  if (!chiffrementDispo()) return json(res, 501, { erreur: "chiffrement_indisponible" });

  const cli = admin();
  const active = versionActive();
  // Seule la clé service_role peut lire la colonne de secret (privilège révoqué pour les autres rôles).
  const { data, error } = await cli.from("integrations").select("id, credentials_sealed, key_version").not("credentials_sealed", "is", null);
  if (error) return json(res, 500, { erreur: "lecture", message: error.message });

  let rescelles = 0, echecs = 0;
  const total = data?.length || 0;
  for (const row of data || []) {
    if (versionDe(row.credentials_sealed) === active) continue; // déjà sur la clé active
    try {
      const clair = ouvrir(row.credentials_sealed);          // le trousseau retrouve l'ancienne clé
      const resealed = sceller(clair);                        // re-scellé avec la clé active
      const w = await cli.from("integrations").update({ credentials_sealed: resealed, key_version: active }).eq("id", row.id);
      if (w.error) { echecs++; } else { rescelles++; }
    } catch { echecs++; } // ancienne clé absente du trousseau, ou intégrité invalide
  }
  return json(res, 200, { versionActive: active, total, rescelles, echecs, dejaAJour: total - rescelles - echecs });
}
