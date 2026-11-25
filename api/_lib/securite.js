/* ============================================================
   VIGIE — utilitaires de sécurité pour les fonctions serverless
   ------------------------------------------------------------
   • Les secrets (client secret d'agrégateur, SESSION_SECRET…) ne vivent
     QUE dans les variables d'environnement du serveur, jamais dans le front.
   • La session est un cookie httpOnly + Secure + SameSite=Lax, signé HMAC :
     impossible à forger côté client, inaccessible au JavaScript du navigateur.
   • Toute écriture (POST/DELETE) vérifie l'origine (protection CSRF).
   ============================================================ */
import crypto from "node:crypto";

export const COOKIE = "vigie_ob";

// Liste blanche des fournisseurs acceptés (doit rester alignée avec src/reglages.js).
export const FOURNISSEURS = new Set(["openbanking", "orange", "wave", "mtn", "moov", "free"]);

// Configuration CinetPay lue depuis l'environnement. Retourne null si incomplète.
// Les secrets (apikey, notifyToken) ne sortent jamais du serveur.
export function config() {
  const c = {
    apikey: process.env.CINETPAY_APIKEY || "",
    siteId: process.env.CINETPAY_SITE_ID || "",
    base: (process.env.CINETPAY_BASE || "https://api-checkout.cinetpay.com").replace(/\/+$/, ""),
    histoBase: (process.env.CINETPAY_HISTO_BASE || "https://api.cinetpay.com").replace(/\/+$/, ""),
    notifyToken: process.env.CINETPAY_NOTIFY_TOKEN || "", // jeton HMAC du webhook (en-tête x-token), si activé
    appOrigin: process.env.APP_ORIGIN || "",
    sessionSecret: process.env.SESSION_SECRET || "",
  };
  const complet = c.apikey && c.siteId;
  return complet ? c : null;
}

/* ---------- réponses JSON normalisées ---------- */
export function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
export const nonConfigure = (res) => json(res, 501, { erreur: "non_configure", message: "Connexion bancaire non configurée sur le serveur." });

/* ---------- contrôle d'origine (anti-CSRF) pour les écritures ---------- */
export function origineAutorisee(req) {
  const cfg = config();
  const attendue = cfg?.appOrigin || (req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : "");
  const brut = req.headers.origin || req.headers.referer || "";
  if (!brut || !attendue) return false;
  try { return new URL(brut).origin === new URL(attendue).origin; }
  catch { return false; }
}

/* ---------- cookie de session signé (HMAC) ---------- */
function signer(charge, secret) {
  const corps = Buffer.from(JSON.stringify(charge)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(corps).digest("base64url");
  return `${corps}.${sig}`;
}
function verifier(valeur, secret) {
  if (!valeur || !valeur.includes(".")) return null;
  const [corps, sig] = valeur.split(".");
  const attendu = crypto.createHmac("sha256", secret).update(corps).digest("base64url");
  // comparaison à temps constant
  const a = Buffer.from(sig), b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(corps, "base64url").toString("utf8")); }
  catch { return null; }
}

function lireCookies(req) {
  const brut = req.headers.cookie || "";
  return Object.fromEntries(brut.split(";").map((p) => p.trim().split("=").map(decodeURIComponent)).filter((x) => x[0]));
}

// Session = { sources: { [fournisseur]: { token, depuis } } } — le token NE sort jamais du serveur.
export function lireSession(req) {
  const cfg = config();
  if (!cfg) return { sources: {} };
  const s = verifier(lireCookies(req)[COOKIE], cfg.sessionSecret);
  return s && typeof s === "object" ? { sources: s.sources || {} } : { sources: {} };
}

export function ecrireSession(res, session) {
  const cfg = config();
  if (!cfg) return;
  const valeur = signer({ sources: session.sources || {} }, cfg.sessionSecret);
  // Max 4 Ko de cookie : on ne stocke que des références de token courtes.
  res.setHeader("Set-Cookie", `${COOKIE}=${valeur}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
}

export function effacerSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// Garde-fou : n'accepte qu'une méthode HTTP donnée.
export function methode(req, res, attendue) {
  if (req.method !== attendue) { json(res, 405, { erreur: "methode", message: `Méthode ${req.method} non autorisée.` }); return false; }
  return true;
}

/* ---------- état OAuth signé (anti-CSRF du flux de redirection) ---------- */
export function signerEtat(charge) {
  const cfg = config(); if (!cfg) return "";
  const corps = Buffer.from(JSON.stringify(charge)).toString("base64url");
  const sig = crypto.createHmac("sha256", cfg.sessionSecret).update(corps).digest("base64url");
  return `${corps}.${sig}`;
}
export function verifierEtat(valeur) {
  const cfg = config(); if (!cfg || !valeur || !valeur.includes(".")) return null;
  const [corps, sig] = valeur.split(".");
  const attendu = crypto.createHmac("sha256", cfg.sessionSecret).update(corps).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(corps, "base64url").toString("utf8")); } catch { return null; }
}

/* ---------- lecture du corps JSON (tolère req.body déjà parsé par Vercel) ---------- */
export async function corpsJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let brut = "";
  for await (const morceau of req) { brut += morceau; if (brut.length > 100000) break; } // garde-fou 100 Ko
  try { return brut ? JSON.parse(brut) : {}; } catch { return {}; }
}

// Ne garde qu'une URL de retour sur l'origine de l'application (anti open-redirect).
export function retourSur(appOrigin, retour, fournisseur, statut = "ok") {
  let base;
  try { base = new URL(retour).origin === new URL(appOrigin).origin ? new URL(retour) : new URL(appOrigin); }
  catch { base = new URL(appOrigin); }
  base.searchParams.set("banque", statut);
  if (fournisseur) base.searchParams.set("fournisseur", fournisseur);
  return base.toString();
}
