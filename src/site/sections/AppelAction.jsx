import { FileSpreadsheet, ArrowRightLeft, BadgeCheck } from "lucide-react";
import { C } from "../theme.js";
import { Conteneur, BoutonDemo, Reveal } from "../components/ui.jsx";

const PARCOURS = [
  [FileSpreadsheet, "Chargez le fichier d'exemple"],
  [ArrowRightLeft, "Basculez côté institution"],
  [BadgeCheck, "Validez le dossier de la PME"],
];

export default function AppelAction() {
  return (
    <section className="py-16 sm:py-24" style={{ background: C.canvas }}>
      <Conteneur>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16" style={{ background: C.ink }}>
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: C.teal }} aria-hidden="true" />
            <h2 className="relative mx-auto max-w-2xl font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl">Essayez VIGIE en deux minutes.</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: C.inkMuted }}>Parcourez l'espace PME avec le fichier d'exemple fourni, puis passez de l'autre côté pour suivre ce même dossier dans un portefeuille.</p>
            <ol className="relative mx-auto mt-8 flex max-w-2xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
              {PARCOURS.map(([Ic, lbl], i) => (
                <li key={lbl} className="flex items-center gap-2 text-sm sm:whitespace-nowrap" style={{ color: "#C9D2DD" }}>
                  <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold" style={{ background: C.ink2, color: "#5EEAD4" }}>{i + 1}</span>
                  <Ic size={15} style={{ color: "#5EEAD4" }} /> {lbl}
                </li>
              ))}
            </ol>
            <BoutonDemo className="relative mt-10 !px-6 !py-3 text-base" />
          </div>
        </Reveal>
      </Conteneur>
    </section>
  );
}
