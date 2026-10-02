import { Layers, ShieldAlert, BadgeCheck, Building2 } from "lucide-react";
import { C } from "../theme.js";
import { Section, EnTete, Reveal, Legende } from "../components/ui.jsx";
import { ApercuPortefeuille } from "../components/Apercus.jsx";

const FONCTIONS = [
  { icone: Layers, nom: "Portefeuille", texte: "Encours brut, PAR 30, PAR 90 et coût du risque. Répartition de l'encours par secteur et par statut de risque." },
  { icone: ShieldAlert, nom: "Alerte précoce", texte: "Les emprunteurs à jour dont le score recule fortement, classés par sévérité × exposition, avec le délai estimé avant tension de trésorerie." },
  { icone: BadgeCheck, nom: "À valider", texte: "Les PME qui partagent leur profil avec votre établissement arrivent ici. Examinez score et trajectoire, puis validez ou écartez." },
  { icone: Building2, nom: "Fiche emprunteur", texte: "Encours, score et tendance, perte attendue, projection du solde et décomposition du score en six signaux." },
];

export default function EspaceInstitution() {
  return (
    <Section id="institution" fond={C.ink}>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <div>
          <EnTete clair surtitre="Espace Institution" titre="Le risque de portefeuille, avant qu'il ne coûte." texte="Pour les institutions de microfinance, les banques et les prêteurs : une vue consolidée de l'encours, et une alerte sur les emprunteurs qui glissent alors que le PAR les dit sains." />
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FONCTIONS.map(({ icone: Ic, nom, texte }, i) => (
              <Reveal key={nom} delai={i * 70}>
                <div className="h-full rounded-xl border p-5" style={{ borderColor: "#24384F", background: "#132438" }}>
                  <Ic size={18} style={{ color: nom === "Alerte précoce" ? "#FCA5A5" : "#5EEAD4" }} />
                  <div className="mt-3 text-sm font-semibold text-white">{nom}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: C.inkMuted }}>{texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delai={120}>
          <ApercuPortefeuille />
          <Legende clair>Portefeuille de démonstration · 47 emprunteurs</Legende>
        </Reveal>
      </div>
    </Section>
  );
}
