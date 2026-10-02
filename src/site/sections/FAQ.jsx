import { ChevronDown } from "lucide-react";
import { C } from "../theme.js";
import { Section, EnTete, Reveal } from "../components/ui.jsx";

const QUESTIONS = [
  ["Faut-il un logiciel comptable ?", "Non. Un fichier Excel (.xlsx, .xlsm) ou CSV de ventes et de dépenses suffit. La correspondance des colonnes s'adapte à votre format : vous n'avez rien à ressaisir."],
  ["Quels moyens de paiement sont reconnus ?", "Virement, espèces, Orange Money, MTN MoMo et prélèvement. Les autres libellés sont regroupés sous « Autre » et restent comptabilisés."],
  ["À quoi sert le rapprochement ?", "À comparer votre comptabilité à vos relevés bancaires ou mobile money. Si votre fichier contient déjà un rapprochement, VIGIE l'affiche. Sinon, ajoutez un relevé pour repérer les encaissements jamais enregistrés et les écritures à vérifier."],
  ["Que voit exactement une institution ?", "Avec votre accord : votre score, son évolution, sa décomposition en six signaux et votre position de trésorerie. Sans accord : uniquement l'encours qu'elle vous a consenti."],
  ["VIGIE remplace-t-il le PAR ?", "Non, il le complète. Le PAR mesure les retards constatés ; l'alerte précoce de VIGIE signale les emprunteurs encore à jour dont la trésorerie se dégrade."],
  ["Puis-je essayer sans mes propres données ?", "Oui. La démo propose un fichier d'exemple complet (ventes, dépenses et rapprochement) ainsi qu'un export sans rapprochement, pour voir les deux parcours."],
];

export default function FAQ() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <EnTete surtitre="FAQ" titre="Questions fréquentes" texte="L'essentiel pour bien démarrer, côté PME comme côté institution." />
        <Reveal className="divide-y divide-[#E3E6E2] rounded-xl border border-[#E3E6E2] bg-white">
          {QUESTIONS.map(([q, r]) => (
            <details key={q} className="group px-5 py-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: C.teal }} />
              </summary>
              <p className="pb-5 text-sm leading-relaxed" style={{ color: C.muted }}>{r}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
