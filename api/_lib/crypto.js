/* ============================================================
   VIGIE — chiffrement des secrets au repos + rotation de clé (serveur, Phase 4)
   ------------------------------------------------------------
   AES-256-GCM (authentifié). Chaque secret scellé porte, en 1er octet, la
   VERSION de la clé qui l'a produit → on peut faire tourner la clé maître
   sans perdre l'accès aux secrets déjà en base.

   Trousseau (keyring) lu dans l'environnement (serveur uniquement) :
   • VIGIE_ENC_KEY           : clé ACTIVE (32 octets base64) — sert à sceller.
   • VIGIE_ENC_KEY_VERSION   : version de la clé active (1..255, défaut 1).
   • VIGIE_ENC_KEYS          : anciennes clés, pour DÉCHIFFRER les secrets pas
                               encore re-scellés : "1:base64,2:base64,…".

   Procédure de rotation :
     1) placer l'ancienne clé dans VIGIE_ENC_KEYS (ex. "1:<ancienne>") ;
     2) mettre la NOUVELLE clé dans VIGIE_ENC_KEY + VIGIE_ENC_KEY_VERSION=2 ;
     3) déclencher le re-scellement (POST /api/admin/rotate-keys) ;
     4) une fois tout en v2, retirer l'ancienne clé de VIGIE_ENC_KEYS.

   • Clés serveur uniquement (jamais VITE_, jamais commitées).
   • Sans clé active valide, chiffrementDispo() = false et les fonctions
     lèvent : on ne stocke JAMAIS un secret en clair en repli.
   • Format scellé (base64) : [version(1o)][iv(12o)][tag(16o)][chiffré].
   ============================================================ */
import crypto from "node:crypto";

const ACTIVE_B64 = process.env.VIGIE_ENC_KEY || "";
const ACTIVE_VERSION = Number(process.env.VIGIE_ENC_KEY_VERSION || "1") | 0;
const EXTRA = process.env.VIGIE_ENC_KEYS || "";

function clef32(b64) { const b = Buffer.from(String(b64 || ""), "base64"); return b.length === 32 ? b : null; }

// Clé active (pour sceller). Lève si absente/invalide.
function cleActive() {
  const k = clef32(ACTIVE_B64);
  if (!k) throw new Error("VIGIE_ENC_KEY absente ou invalide (32 octets en base64 attendus).");
  if (!(ACTIVE_VERSION >= 1 && ACTIVE_VERSION <= 255)) throw new Error("VIGIE_ENC_KEY_VERSION invalide (1..255).");
  return { version: ACTIVE_VERSION, key: k };
}

// Trousseau complet { version -> clé } : clés anciennes (VIGIE_ENC_KEYS) + clé active.
function trousseau() {
  const m = new Map();
  for (const part of EXTRA.split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(":"); if (i <= 0) continue;
    const v = Number(part.slice(0, i)) | 0; const k = clef32(part.slice(i + 1));
    if (v >= 1 && v <= 255 && k) m.set(v, k);
  }
  const k = clef32(ACTIVE_B64);
  if (k && ACTIVE_VERSION >= 1 && ACTIVE_VERSION <= 255) m.set(ACTIVE_VERSION, k); // la clé active prime
  return m;
}

export function chiffrementDispo() { try { cleActive(); return true; } catch { return false; } }
export function versionActive() { return cleActive().version; }
export function versionDe(scelleB64) { const b = Buffer.from(String(scelleB64 || ""), "base64"); return b.length ? b[0] : null; }

// Scelle un objet JSON → base64, avec la clé ACTIVE (son numéro en 1er octet).
export function sceller(objet) {
  const { version, key } = cleActive();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const chiffre = Buffer.concat([c.update(Buffer.from(JSON.stringify(objet), "utf8")), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([Buffer.from([version]), iv, tag, chiffre]).toString("base64");
}

// Ouvre une chaîne scellée → objet JSON. Sélectionne la clé d'après l'octet de version.
export function ouvrir(scelleB64) {
  const b = Buffer.from(String(scelleB64 || ""), "base64");
  if (b.length < 29) throw new Error("Format scellé invalide.");
  const version = b[0];
  const key = trousseau().get(version);
  if (!key) throw new Error(`Clé de chiffrement version ${version} introuvable (rotation en cours ?).`);
  const iv = b.subarray(1, 13), tag = b.subarray(13, 29), chiffre = b.subarray(29);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(chiffre), d.final()]).toString("utf8"));
}
