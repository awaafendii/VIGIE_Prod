/* ============================================================
   VIGIE — portail d'accès à l'application
   ------------------------------------------------------------
   • Auth NON configurée (pas de Supabase) : rend l'application telle
     quelle, en mode démonstration — rien n'est supprimé.
   • Auth configurée : exige une identité avant d'ouvrir l'application.
     Le périmètre (PME / institution) viendra des organisations réelles
     renvoyées par le serveur (phases suivantes) ; ici, on garantit déjà
     qu'on n'entre pas dans l'application sans compte vérifié.
   ============================================================ */
import { useState } from "react";
import App from "./App.jsx";
import { authDisponible, useSession, connexion, deconnexion } from "./auth.js";

const C = { ink: "#0E1B2C", canvas: "#F5F6F4", teal: "#0F766E", muted: "#5B6472", hairline: "#E3E6E2", rouge: "#B91C1C" };

export default function AppGate() {
  const session = useSession(); // toujours appelé (hook inconditionnel) ; no-op si auth désactivée

  if (!authDisponible) return <App />;                 // mode démo inchangé
  if (session.chargement) return <Ecran>Chargement de votre session…</Ecran>;
  if (!session.utilisateur) return <LoginScreen />;

  return (
    <>
      <App session={session} />
      <SessionChip session={session} />
    </>
  );
}

function Ecran({ children }) {
  return <div className="grid min-h-full place-items-center p-6 text-sm" style={{ background: C.canvas, color: C.muted }}>{children}</div>;
}

function SessionChip({ session }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border bg-white/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur" style={{ borderColor: C.hairline, color: C.ink }}>
      <span className="max-w-[160px] truncate font-semibold">{session.utilisateur.email}</span>
      <button onClick={() => deconnexion()} className="font-semibold" style={{ color: C.teal }}>Déconnexion</button>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null); setOccupe(true);
    try { await connexion(email, mdp); }           // onAuthStateChange déclenche le rechargement de session
    catch (ex) { setErreur(ex?.message || "Connexion impossible."); }
    finally { setOccupe(false); }
  }

  const champ = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none";
  return (
    <div className="grid min-h-full place-items-center p-6" style={{ background: C.canvas }}>
      <form onSubmit={soumettre} className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: C.hairline }}>
        <div className="text-lg font-bold" style={{ color: C.ink }}>VIGIE</div>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>Connectez-vous pour accéder à votre espace.</p>
        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: C.muted }}>Email</label>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={champ} style={{ borderColor: C.hairline }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: C.muted }}>Mot de passe</label>
            <input type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} className={champ} style={{ borderColor: C.hairline }} />
          </div>
        </div>
        {erreur && <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "#FEF2F2", color: C.rouge }}>{erreur}</div>}
        <button type="submit" disabled={occupe} className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: C.ink }}>
          {occupe ? "Connexion…" : "Se connecter"}
        </button>
        <p className="mt-4 text-[11px]" style={{ color: C.muted }}>Accès réservé. La création de compte et le rattachement à une organisation sont gérés par l'administration VIGIE.</p>
      </form>
    </div>
  );
}
