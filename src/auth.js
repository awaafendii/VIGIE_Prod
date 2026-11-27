/* ============================================================
   VIGIE — authentification côté navigateur (Supabase Auth)
   ------------------------------------------------------------
   • Désactivée tant que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
     ne sont pas définis : authDisponible = false et l'application
     garde son mode démonstration, inchangé.
   • La clé « anon » est PUBLIQUE par conception (elle n'ouvre rien :
     la RLS côté PostgreSQL protège les données). Aucun secret serveur
     (service_role) ne doit jamais figurer ici.
   • Le périmètre de droits n'est JAMAIS décidé par le front : il est
     lu auprès du serveur via GET /api/auth/session.
   ============================================================ */
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const BASE = (import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");

export const authDisponible = !!(URL && ANON);

// Verrou « pass-through » : on n'utilise PAS navigator.locks, qui peut bloquer
// indéfiniment quand VIGIE est ouverte dans plusieurs onglets/fenêtres du même
// navigateur (le verrou d'auth est partagé par origine). On exécute la section
// critique sans verrou inter-onglets — suffisant ici (rafraîchissements rares).
const sansVerrou = (_nom, _delai, fn) => fn();

export const supabase = authDisponible
  ? createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, lock: sansVerrou } })
  : null;

// Course contre une échéance : évite qu'une promesse qui ne se résout jamais
// (verrou, onglet en veille…) laisse l'écran bloqué sur « Chargement… ».
function avecDelai(promesse, ms, valeurSiDelai) {
  return Promise.race([
    promesse,
    new Promise((resoudre) => setTimeout(() => resoudre(valeurSiDelai), ms)),
  ]);
}

export async function connexion(email, motDePasse) {
  if (!supabase) throw new Error("Authentification non configurée.");
  const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password: motDePasse });
  if (error) throw error;
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}

async function jetonActuel() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

// Appel API authentifié : attache le JWT en en-tête Bearer.
export async function fetchAuth(chemin, options = {}) {
  const token = await jetonActuel();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${chemin}`, { ...options, headers, credentials: "include" });
}

/* ---------- hook de session : identité + organisations (droits serveur) ---------- */
export function useSession() {
  const [etat, setEtat] = useState(() => ({
    disponible: authDisponible,
    chargement: authDisponible,
    utilisateur: null,
    organisations: [],
    erreur: null,
  }));

  async function rafraichir() {
    if (!authDisponible) { setEtat((s) => ({ ...s, chargement: false })); return; }
    try {
      const res = await avecDelai(supabase.auth.getSession(), 8000, { data: null, __delai: true });
      if (res?.__delai) { setEtat((s) => ({ ...s, chargement: false, utilisateur: null, organisations: [], erreur: "session_delai" })); return; }
      const data = res?.data;
      if (!data?.session) { setEtat((s) => ({ ...s, chargement: false, utilisateur: null, organisations: [] })); return; }
      const rep = await fetchAuth("/api/auth/session");
      if (!rep.ok) { setEtat((s) => ({ ...s, chargement: false, utilisateur: { id: data.session.user.id, email: data.session.user.email }, organisations: [], erreur: rep.status === 501 ? "non_configure" : "session" })); return; }
      const j = await rep.json();
      setEtat({ disponible: true, chargement: false, utilisateur: j.utilisateur, organisations: j.organisations || [], erreur: null });
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message || "erreur" }));
    }
  }

  useEffect(() => {
    if (!authDisponible) return;
    rafraichir();
    const { data: sub } = supabase.auth.onAuthStateChange(() => rafraichir());
    return () => sub?.subscription?.unsubscribe?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...etat, rafraichir };
}
