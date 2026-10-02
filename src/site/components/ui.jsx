import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { C, APP_HREF } from "../theme.js";

/* ---------- briques communes du site (mêmes codes que l'application) ---------- */
export function Logo({ clair = false, sousTitre = false }) {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="VIGIE — accueil">
      <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: C.teal }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 8.5 12 19l7-10.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="5" r="2" fill="#fff" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-[0.14em]" style={{ color: clair ? "#fff" : C.ink }}>VIGIE</span>
        {sousTitre && <span className="block text-[11px]" style={{ color: clair ? C.inkMuted : C.muted }}>Trésorerie & risque de crédit</span>}
      </span>
    </a>
  );
}

export function Conteneur({ children, className = "" }) {
  return <div className={"mx-auto max-w-6xl px-4 sm:px-8 " + className}>{children}</div>;
}

export function Section({ id, fond = C.canvas, children, className = "" }) {
  return <section id={id} className={"scroll-mt-16 py-16 sm:py-24 " + className} style={{ background: fond }}><Conteneur>{children}</Conteneur></section>;
}

export function EnTete({ surtitre, titre, texte, clair = false, centre = false }) {
  return (
    <Reveal className={"max-w-2xl " + (centre ? "mx-auto text-center" : "")}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: clair ? "#5EEAD4" : C.teal }}>{surtitre}</div>
      <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: clair ? "#fff" : C.ink }}>{titre}</h2>
      {texte && <p className="mt-4 text-base leading-relaxed" style={{ color: clair ? C.inkMuted : C.muted }}>{texte}</p>}
    </Reveal>
  );
}

export function Carte({ children, className = "", style = {} }) {
  return <div className={"rounded-xl bg-white " + className} style={{ border: `1px solid ${C.hairline}`, ...style }}>{children}</div>;
}

export function Barre({ valeur, couleur }) {
  return <div className="h-2 w-full rounded-full" style={{ background: C.piste }}><div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, valeur))}%`, background: couleur }} /></div>;
}

export function BoutonDemo({ children = "Lancer la démo", variante = "teal", className = "" }) {
  const styles = { teal: { background: C.teal, color: "#fff" }, ink: { background: C.ink, color: "#fff" }, blanc: { background: "#fff", color: C.ink } };
  return (
    <a href={APP_HREF} className={"inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 " + className} style={styles[variante]}>
      {children} <ArrowRight size={16} />
    </a>
  );
}

// légende discrète sous les aperçus de l'application
export function Legende({ children, clair = false }) {
  return <div className="mt-3 text-center text-[11px]" style={{ color: clair ? C.inkMuted : C.muted }}>{children}</div>;
}

// apparition douce au défilement (désactivée si l'utilisateur réduit les animations)
export function Reveal({ as: Balise = "div", children, className = "", delai = 0 }) {
  const ref = useRef(null);
  const [vu, setVu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVu(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVu(true); obs.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Balise ref={ref} className={"transition duration-700 ease-out " + (vu ? "opacity-100 translate-y-0" : "motion-safe:translate-y-4 motion-safe:opacity-0") + " " + className} style={{ transitionDelay: `${delai}ms` }}>
      {children}
    </Balise>
  );
}
