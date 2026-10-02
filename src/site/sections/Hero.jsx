import { CheckCircle2, Link2, ShieldAlert, Store } from "lucide-react";
import { C } from "../theme.js";
import { PME, PORTEFEUILLE } from "../demo.js";
import { Conteneur, BoutonDemo, Legende } from "../components/ui.jsx";
import { CadreApp, BlocTresorerie, BlocFlux, LigneWatchlist } from "../components/Apercus.jsx";

const ATOUTS = ["Import Excel ou CSV, sans logiciel comptable", "Espèces et mobile money pris en compte", "Partage du profil sur consentement"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: C.ink }}>
      {/* trame discrète, rappel des grilles de graphiques de l'application */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%)" }} />
      <Conteneur className="relative grid items-center gap-12 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: C.ink2, color: "#5EEAD4" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#5EEAD4" }} /> Trésorerie PME · Risque de crédit
          </div>
          <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Voir le risque<br />avant l'impayé.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: C.inkMuted }}>
            VIGIE relie la trésorerie réelle des PME au portefeuille des institutions qui les financent. Les entrepreneurs pilotent leur cash&nbsp;; les financeurs repèrent les emprunteurs qui se dégradent alors qu'ils sont encore à jour.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BoutonDemo />
            <a href="#fonctionnement" className="inline-flex items-center rounded-lg border px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5" style={{ borderColor: "#2B405A" }}>Comment ça marche</a>
          </div>
          <ul className="mt-10 space-y-2.5">
            {ATOUTS.map((a) => <li key={a} className="flex items-center gap-2.5 text-sm" style={{ color: "#C9D2DD" }}><CheckCircle2 size={16} style={{ color: "#5EEAD4" }} /> {a}</li>)}
          </ul>
        </div>

        <div className="relative lg:pl-6">
          <CadreApp titre={`Espace PME — ${PME.nom} · ${PME.periode}`} icone={Store}>
            <BlocTresorerie />
            <BlocFlux />
          </CadreApp>
          <div className="relative z-20 mx-auto -mt-3 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: C.teal, color: "#fff" }}>
            <Link2 size={12} /> profil partagé avec consentement
          </div>
          <div className="relative z-10 -mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] sm:ml-10 lg:-ml-8 lg:mr-8" style={{ border: `1px solid ${C.hairline}` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.rouge }}><ShieldAlert size={14} /> Espace Institution · Alerte précoce</span>
              <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.rouge }}>{PORTEFEUILLE.alerte.nb}</span>
            </div>
            <div className="divide-y" style={{ borderColor: C.hairline }}>
              {PORTEFEUILLE.watchlist.slice(0, 2).map((e) => <LigneWatchlist key={e.nom} e={e} />)}
            </div>
          </div>
          <Legende clair>Aperçu de l'application · données de démonstration</Legende>
        </div>
      </Conteneur>
    </section>
  );
}
