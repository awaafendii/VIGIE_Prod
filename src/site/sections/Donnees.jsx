import { Link2, ToggleRight, Lock } from "lucide-react";
import { C } from "../theme.js";
import { Section, EnTete, Reveal, Legende } from "../components/ui.jsx";
import { ApercuPartage } from "../components/Apercus.jsx";

const PRINCIPES = [
  { icone: Link2, titre: "Partage établissement par établissement", texte: "La PME choisit quelles institutions peuvent consulter son profil, et voit à tout moment la liste des accès accordés." },
  { icone: ToggleRight, titre: "Révocable à tout moment", texte: "Un interrupteur suffit pour retirer l'accès. Le statut de chaque partage reste visible : en attente ou dossier validé." },
  { icone: Lock, titre: "Sans accord, accès limité à l'encours", texte: "Tant que la PME n'a pas partagé son profil, l'institution ne voit ni score, ni signaux, ni trésorerie." },
];

export default function Donnees() {
  return (
    <Section id="donnees" fond="#fff">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <EnTete surtitre="Données & consentement" titre="La PME reste propriétaire de ses données." texte="Le profil de trésorerie appartient à l'entreprise qui l'a produit. C'est elle qui décide qui le voit, et elle peut revenir sur sa décision." />
          <ul className="mt-10 space-y-6">
            {PRINCIPES.map(({ icone: Ic, titre, texte }, i) => (
              <Reveal as="li" key={titre} delai={i * 80} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: C.tealTint }}><Ic size={18} style={{ color: C.teal }} /></span>
                <div><div className="text-base font-semibold">{titre}</div><p className="mt-1 text-sm leading-relaxed" style={{ color: C.muted }}>{texte}</p></div>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal delai={120} className="mx-auto w-full max-w-md">
          <div className="rounded-3xl p-5 sm:p-8" style={{ background: C.canvas }}>
            <ApercuPartage />
          </div>
          <Legende>Essayez : les interrupteurs fonctionnent comme dans l'application.</Legende>
        </Reveal>
      </div>
    </Section>
  );
}
