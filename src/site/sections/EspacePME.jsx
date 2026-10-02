import { HeartPulse, GitCompareArrows, ShieldCheck, Check } from "lucide-react";
import { C } from "../theme.js";
import { Section, EnTete, Reveal, Legende } from "../components/ui.jsx";
import { ApercuTresorerie, ApercuRapprochement, ApercuFinancement } from "../components/Apercus.jsx";

const FONCTIONS = [
  {
    icone: HeartPulse, nom: "Ma trésorerie", titre: "Ce qui est entré, ce qui reste à encaisser.",
    texte: "Deux chiffres suffisent pour décider : la trésorerie nette réalisée, et la position projetée si tous les impayés se règlent.",
    points: ["Encaissé et décaissé distingués de ce qui reste dû", "Ventilation par canal : virement, espèces, Orange Money, Wave", "Montants exprimés en FCFA"],
    apercu: ApercuTresorerie,
  },
  {
    icone: GitCompareArrows, nom: "Rapprochement", titre: "Retrouvez l'argent que votre comptabilité ignore.",
    texte: "Si votre fichier contient déjà un rapprochement, VIGIE l'affiche compte par compte. Sinon, ajoutez un relevé Wave, Orange Money ou bancaire pour détecter les écarts.",
    points: ["Encaissements présents au relevé mais jamais saisis", "Écritures comptables absentes du relevé, à vérifier", "Pointage tolérant aux frais mobile money et aux décalages de quelques jours"],
    apercu: ApercuRapprochement,
  },
  {
    icone: ShieldCheck, nom: "Mon financement", titre: "Votre dossier, tel qu'un financeur le lit.",
    texte: "Votre santé financière du mois, son évolution, et les trois indicateurs qui comptent pour un prêteur, chacun expliqué en une ligne.",
    points: ["Taux d'encaissement, marge nette, poids des charges fixes", "Évolution de votre santé financière sur quatre mois", "Partage du profil avec les institutions de votre choix"],
    apercu: ApercuFinancement,
  },
];

export default function EspacePME() {
  return (
    <Section id="pme" fond="#fff">
      <EnTete surtitre="Espace PME" titre="Votre trésorerie, enfin lisible." texte="Pas de jargon : l'argent réellement encaissé, ce qui reste à recevoir, et ce qu'un financeur verrait en ouvrant votre dossier." />
      <div className="mt-14 space-y-20 sm:space-y-24">
        {FONCTIONS.map(({ icone: Ic, nom, titre, texte, points, apercu: Apercu }, i) => (
          <div key={nom} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className={i % 2 ? "lg:order-2" : ""}>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: C.tealTint, color: C.teal }}><Ic size={14} /> {nom}</div>
              <h3 className="mt-4 font-serif text-2xl font-semibold leading-snug sm:text-3xl">{titre}</h3>
              <p className="mt-3 text-base leading-relaxed" style={{ color: C.muted }}>{texte}</p>
              <ul className="mt-6 space-y-3">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: C.tealTint }}><Check size={12} style={{ color: C.teal }} strokeWidth={3} /></span>{p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delai={120} className={"mx-auto w-full max-w-lg " + (i % 2 ? "lg:order-1" : "")}>
              <Apercu />
              <Legende>Fichier d'exemple NPM Multiservices · juin 2026</Legende>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}
