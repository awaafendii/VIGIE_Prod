import { C } from "../theme.js";
import { Section, EnTete, Reveal, Legende } from "../components/ui.jsx";
import { ApercuCorrespondance } from "../components/Apercus.jsx";

// les quatre étapes de l'import, dans l'ordre de l'application
const ETAPES = [
  { titre: "Dépôt", texte: "Glissez votre fichier .xlsx, .xlsm ou .csv. VIGIE repère les feuilles ventes et dépenses, et la ligne d'en-tête." },
  { titre: "Correspondance", texte: "Date, montant, canal, statut, contrepartie, libellé, référence : chaque champ est relié automatiquement à une colonne. Vous corrigez si besoin, quel que soit votre format." },
  { titre: "Validation", texte: "Les dates invalides, les montants nuls et les doublons sont écartés et comptés. Vous savez exactement ce qui a été retenu." },
  { titre: "Profil", texte: "Encaissé, à recevoir, décaissé, à payer : l'argent réellement entré est séparé de ce qui reste dû." },
];

export default function Fonctionnement() {
  return (
    <Section id="fonctionnement">
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <EnTete surtitre="Fonctionnement" titre="De votre fichier Excel à un profil fiable, en quatre étapes." texte="Pas de saisie à refaire, pas de logiciel à installer. VIGIE part du fichier que la PME tient déjà." />
          <ol className="mt-10 space-y-0">
            {ETAPES.map((e, i) => (
              <Reveal as="li" key={e.titre} delai={i * 80} className="relative flex gap-4 pb-8 last:pb-0">
                  {i < ETAPES.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2.75rem)] w-px" style={{ background: C.hairline }} aria-hidden="true" />}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: C.teal }}>{i + 1}</span>
                  <div className="pt-1">
                    <div className="text-base font-semibold">{e.titre}</div>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: C.muted }}>{e.texte}</p>
                  </div>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal className="lg:sticky lg:top-24">
          <ApercuCorrespondance />
          <Legende>Correspondance détectée automatiquement sur le fichier d'exemple · 27 lignes valides, 0 rejet</Legende>
        </Reveal>
      </div>
    </Section>
  );
}
