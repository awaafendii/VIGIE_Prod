/* ============================================================
   VIGIE — client d'accès bancaire RÉEL (rapprochement)
   ------------------------------------------------------------
   Principe de sécurité (non négociable) :
   • Le navigateur ne voit JAMAIS les secrets (client secret, clé API,
     identifiants bancaires). Ils restent sur le backend.
   • La connexion passe par une redirection OAuth / consentement hébergée
     par le fournisseur (DSP2, Wave, Orange Money…). L'utilisateur ne tape
     jamais son mot de passe bancaire dans VIGIE.
   • La session est portée par un cookie httpOnly posé par le backend
     (d'où `credentials: "include"`), pas par un jeton stocké dans le front.
   • Le front ne reçoit que la liste des transactions déjà normalisées.

   Contrat d'API (backend, cf. dossier /api) :
     GET    {base}/api/banque/connexions
            → { connexions: [{ fournisseur, nb, sync, depuis }] }
     POST   {base}/api/banque/lien          body { fournisseur, retour }
            → { url }        (URL de consentement hébergée à ouvrir)
     GET    {base}/api/banque/transactions?fournisseur=X&mois=YYYY-MM
            → { transactions: [{ date, montant, canal, libelle, frais }] }
     DELETE {base}/api/banque/connexions?fournisseur=X
            → { ok: true }

   Non configuré : le backend répond 501 { erreur: "non_configure" }.
   ============================================================ */

// Base de l'API : même origine par défaut (/api via les fonctions Vercel),
// ou un backend distant via VITE_API_BASE (doit être en HTTPS).
const BASE = (import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");

if (BASE && !/^https:\/\//i.test(BASE) && !/^http:\/\/localhost(:\d+)?$/i.test(BASE)) {
  // Un backend distant en clair exposerait la session : on refuse tôt.
  // (localhost toléré pour le développement.)
  console.error("[VIGIE] VITE_API_BASE doit être en HTTPS :", BASE);
}

export class ErreurBanque extends Error {
  constructor(message, code = "erreur") { super(message); this.name = "ErreurBanque"; this.code = code; }
}

const MSG = {
  non_configure: "La connexion bancaire n'est pas encore configurée sur le serveur (clé d'agrégateur manquante).",
  reseau: "Serveur injoignable. Vérifiez la connexion, puis réessayez.",
  delai: "Le fournisseur met trop de temps à répondre. Réessayez.",
  auth: "La session a expiré. Reconnectez la source.",
  refus: "Accès refusé par le fournisseur.",
  erreur: "Une erreur est survenue pendant la synchronisation.",
};

function urlApi(chemin) { return `${BASE}${chemin}`; }

/* Appel JSON tolérant : timeout, cookies de session, erreurs typées. */
async function appel(chemin, { methode = "GET", corps = null, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeout);
  let rep;
  try {
    rep = await fetch(urlApi(chemin), {
      method: methode,
      credentials: "include",                 // cookie de session httpOnly
      headers: {
        Accept: "application/json",
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
    });
  } catch (e) {
    clearTimeout(minuteur);
    throw new ErreurBanque(e.name === "AbortError" ? MSG.delai : MSG.reseau, e.name === "AbortError" ? "delai" : "reseau");
  }
  clearTimeout(minuteur);

  let data = null;
  try { data = await rep.json(); } catch { /* corps non-JSON */ }

  if (rep.status === 501 || data?.erreur === "non_configure") throw new ErreurBanque(MSG.non_configure, "non_configure");
  if (rep.status === 401 || rep.status === 419) throw new ErreurBanque(MSG.auth, "auth");
  if (rep.status === 403) throw new ErreurBanque(MSG.refus, "refus");
  if (!rep.ok) throw new ErreurBanque(data?.message || MSG.erreur, data?.erreur || "erreur");
  return data || {};
}

/* Normalisation défensive d'une transaction renvoyée par le backend
   vers la forme attendue par le rapprochement : {date, montant, canal, libelle, frais}. */
function normaliser(t, canalDefaut) {
  const date = String(t.date || t.valueDate || t.bookingDate || "").slice(0, 10);
  const brut = Number(t.montant ?? t.amount ?? 0);
  const montant = Math.round(Number.isFinite(brut) ? brut : 0);
  const frais = Math.round(Number(t.frais ?? t.fees ?? 0)) || 0;
  const libelle = String(t.libelle ?? t.label ?? t.description ?? t.remittanceInformation ?? "Opération").slice(0, 140);
  const canal = String(t.canal ?? t.channel ?? canalDefaut ?? "Banque").slice(0, 40);
  return { date, montant, canal, libelle, frais };
}

/* Transactions valides uniquement : date ISO + montant strictement positif
   (le rapprochement ne traite que les encaissements). */
function filtrerReleve(liste, canalDefaut) {
  if (!Array.isArray(liste)) return [];
  return liste
    .map((t) => normaliser(t, canalDefaut))
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.montant > 0);
}

/* --------- API publique utilisée par l'application --------- */

// Liste des sources déjà connectées pour cet utilisateur.
export async function listerConnexions() {
  const d = await appel("/api/banque/connexions");
  return Array.isArray(d.connexions) ? d.connexions : [];
}

// Démarre la connexion.
// • Agrégateur à redirection (OAuth) → renvoie { url } : page de consentement à ouvrir.
// • Agrégateur à compte marchand (CinetPay) → renvoie { mode: "direct" } : rien à autoriser,
//   l'appelant enchaîne sur une synchronisation.
export async function demarrerConnexion(fournisseur, retour = window.location.href) {
  const d = await appel("/api/banque/lien", { methode: "POST", corps: { fournisseur, retour } });
  if (d.mode === "direct") return { mode: "direct" };
  if (d.url && /^https:\/\//i.test(d.url)) return { url: d.url };
  throw new ErreurBanque(MSG.erreur, "erreur");
}

// Récupère le relevé réel d'une source pour un mois donné (YYYY-MM).
export async function recupererReleve(fournisseur, mois, canalDefaut) {
  const q = new URLSearchParams({ fournisseur, ...(mois ? { mois } : {}) });
  const d = await appel(`/api/banque/transactions?${q.toString()}`);
  return filtrerReleve(d.transactions, canalDefaut);
}

// Déconnecte une source (révoque le consentement côté backend).
export async function deconnecterSource(fournisseur) {
  await appel(`/api/banque/connexions?fournisseur=${encodeURIComponent(fournisseur)}`, { methode: "DELETE" });
  return true;
}

// Lit le retour OAuth dans l'URL ( ?banque=ok|refus&fournisseur=... ) et nettoie la barre d'adresse.
export function lireRetourOAuth() {
  try {
    const p = new URLSearchParams(window.location.search);
    const statut = p.get("banque");
    if (!statut) return null;
    const fournisseur = p.get("fournisseur") || null;
    p.delete("banque"); p.delete("fournisseur");
    const reste = p.toString();
    const propre = window.location.pathname + (reste ? `?${reste}` : "") + window.location.hash;
    window.history.replaceState({}, "", propre);
    return { statut, fournisseur };
  } catch { return null; }
}

export const messageErreur = (code) => MSG[code] || MSG.erreur;
