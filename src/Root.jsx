import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Site from "./site/Site.jsx";
import { APP_HREF } from "./site/theme.js";

/* ============================================================
   Point d'entrée : site vitrine (#/) ou application (#/app).
   Routage par ancre — aucun réglage serveur nécessaire
   (Vercel, dossier dist/ ouvert hors-ligne, etc.).
   ============================================================ */
// l'application (xlsx, recharts) n'est téléchargée qu'à l'ouverture de la démo
const App = lazy(() => import("./App.jsx"));

const lireRoute = () => (window.location.hash.startsWith(APP_HREF) ? "app" : "site");

export default function Root() {
  const [route, setRoute] = useState(lireRoute);
  const premier = useRef(true);

  useEffect(() => {
    const onHash = () => setRoute(lireRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // remonter en haut uniquement quand on change d'écran (pas pour les ancres internes du site)
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);

  useEffect(() => {
    document.title = route === "app" ? "VIGIE — Application" : "VIGIE — Trésorerie PME & risque de crédit";
  }, [route]);

  if (route === "site") return <Site />;
  return (
    <>
      <Suspense fallback={<div className="grid min-h-full place-items-center text-sm" style={{ background: "#F5F6F4", color: "#5B6472" }}>Chargement de VIGIE…</div>}>
        <App />
      </Suspense>
      <a href="#/" className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur hover:bg-white" style={{ borderColor: "#E3E6E2", color: "#0E1B2C" }}>
        <ArrowLeft size={14} /> Site VIGIE
      </a>
    </>
  );
}
