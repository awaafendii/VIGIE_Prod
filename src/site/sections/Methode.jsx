import { C } from "../theme.js";
import { SIGNAUX, PME } from "../demo.js";
import { Section, EnTete, Carte, Reveal } from "../components/ui.jsx";

// dégradé de teintes teal pour distinguer les six signaux
const TEINTES = ["#0F766E", "#14897F", "#2A9D8F", "#4FB3A6", "#7CC8BD", "#A9DCD3"];

export default function Methode() {
  return (
    <Section id="methode">
      <EnTete surtitre="Méthode" titre="Un score explicable, pas une boîte noire." texte="Le score VIGIE, sur 100, agrège six signaux de trésorerie pondérés. L'institution voit la contribution de chacun ; la PME lit les mêmes données sous forme d'indicateurs simples." />

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Reveal>
          <Carte className="h-full p-6 sm:p-7">
            <div className="text-sm font-semibold">Composition du score</div>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full" role="img" aria-label={"Pondération : " + SIGNAUX.map(([n, p]) => `${n} ${p} %`).join(", ")}>
              {SIGNAUX.map(([nom, poids], i) => <div key={nom} style={{ width: `${poids}%`, background: TEINTES[i] }} className={i ? "border-l-2 border-white" : ""} />)}
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {SIGNAUX.map(([nom, poids, def], i) => (
                <li key={nom} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TEINTES[i] }} />
                  <div>
                    <div className="flex items-baseline gap-2 text-sm"><span className="font-semibold">{nom}</span><span className="tabular-nums text-xs font-semibold" style={{ color: C.teal }}>{poids} %</span></div>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: C.muted }}>{def}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Carte>
        </Reveal>

        <div className="grid gap-5">
          <Reveal delai={90}>
            <Carte className="p-6">
              <div className="text-sm font-semibold">Perte attendue</div>
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-serif text-xl font-semibold">
                <span style={{ color: C.ambre }}>ECL</span><span style={{ color: C.muted }}>=</span><span>EAD</span><span style={{ color: C.muted }}>×</span><span>PD</span><span style={{ color: C.muted }}>×</span><span>LGD</span>
              </div>
              <dl className="mt-4 space-y-1.5 text-xs" style={{ color: C.muted }}>
                <div><dt className="inline font-semibold" style={{ color: C.ink }}>EAD</dt> <dd className="inline">· encours exposé</dd></div>
                <div><dt className="inline font-semibold" style={{ color: C.ink }}>PD</dt> <dd className="inline">· probabilité de défaut, déduite du score et du retard</dd></div>
                <div><dt className="inline font-semibold" style={{ color: C.ink }}>LGD</dt> <dd className="inline">· perte en cas de défaut, fixée à 45 %</dd></div>
              </dl>
            </Carte>
          </Reveal>
          <Reveal delai={160}>
            <Carte className="p-6">
              <div className="text-sm font-semibold">Côté PME, trois indicateurs</div>
              <ul className="mt-3 space-y-2.5">
                {PME.indicateurs.map(([nom, , note]) => (
                  <li key={nom} className="text-sm"><span className="font-medium">{nom}</span><span className="block text-xs" style={{ color: C.muted }}>{note}</span></li>
                ))}
              </ul>
            </Carte>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
