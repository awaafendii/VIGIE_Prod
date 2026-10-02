import { UploadCloud, HeartPulse, GitCompareArrows, ShieldCheck, Layers, BadgeCheck, ShieldAlert, Building2, Store, Landmark, Lock, ArrowRight } from "lucide-react";
import { C } from "../theme.js";
import { Section, EnTete, Carte, Reveal } from "../components/ui.jsx";

const FLUX = [
  { qui: "PME", titre: "Import du fichier", texte: "Ventes et dépenses, tel quel." },
  { qui: "PME", titre: "Profil de trésorerie", texte: "Calculé sur l'argent réellement encaissé." },
  { qui: "PME", titre: "Consentement", texte: "Partage choisi, établissement par établissement.", verrou: true },
  { qui: "Institution", titre: "Validation & suivi", texte: "Le dossier entre au portefeuille, sous alerte précoce." },
];

const ESPACES = [
  {
    id: "#pme", icone: Store, nom: "Espace PME", pour: "Pour les entrepreneurs", couleur: C.teal,
    texte: "Comprendre sa trésorerie, retrouver l'argent non enregistré et savoir comment un financeur lit son dossier.",
    onglets: [[UploadCloud, "Import"], [HeartPulse, "Ma trésorerie"], [GitCompareArrows, "Rapprochement"], [ShieldCheck, "Mon financement"]],
  },
  {
    id: "#institution", icone: Landmark, nom: "Espace Institution", pour: "Pour les IMF, banques et prêteurs", couleur: C.ink,
    texte: "Suivre la qualité du portefeuille, valider les nouveaux dossiers et agir sur les emprunteurs qui se dégradent.",
    onglets: [[Layers, "Portefeuille"], [BadgeCheck, "À valider"], [ShieldAlert, "Alerte précoce"], [Building2, "Emprunteurs"]],
  },
];

export default function Espaces() {
  return (
    <Section id="produit" fond="#fff">
      <EnTete surtitre="La plateforme" titre="Deux espaces, une même donnée." texte="La PME importe son fichier de gestion. Le profil calculé lui sert à piloter sa trésorerie et, si elle le décide, alimente le suivi de risque de ses financeurs." />

      <Reveal className="mt-10">
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {FLUX.map((f, i) => (
            <li key={f.titre} className="relative flex items-stretch">
              <div className="flex-1 rounded-xl p-4" style={{ background: f.verrou ? C.tealTint : C.canvas, border: `1px solid ${f.verrou ? "#B7D7D3" : C.hairline}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: f.qui === "PME" ? C.teal : C.ink }}>{f.qui}</span>
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: f.verrou ? C.teal : C.ink }}>{f.verrou ? <Lock size={11} /> : i + 1}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{f.titre}</div>
                <div className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{f.texte}</div>
              </div>
              {i < FLUX.length - 1 && <ArrowRight size={16} className="absolute -right-[13px] top-1/2 z-10 hidden -translate-y-1/2 lg:block" style={{ color: C.muted }} />}
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {ESPACES.map(({ id, icone: Ic, nom, pour, couleur, texte, onglets }, i) => (
          <Reveal key={nom} delai={i * 90}>
            <Carte className="flex h-full flex-col p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-lg text-white" style={{ background: couleur }}><Ic size={20} /></div>
                <div><div className="text-lg font-semibold">{nom}</div><div className="text-xs" style={{ color: C.muted }}>{pour}</div></div>
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: C.muted }}>{texte}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {onglets.map(([OI, lbl]) => <span key={lbl} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: C.hairline }}><OI size={13} style={{ color: couleur }} /> {lbl}</span>)}
              </div>
              <a href={id} className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold" style={{ color: C.teal }}>Voir le détail <ArrowRight size={15} /></a>
            </Carte>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
