import { FileSpreadsheet, Smartphone, EyeOff, ShieldAlert } from "lucide-react";
import { C, STATUTS } from "../theme.js";
import { Section, EnTete, Carte, Reveal } from "../components/ui.jsx";

// paliers de retard : mêmes seuils que la classification de l'application
const PALIERS = [
  { statut: "Arriérés", plage: "1 à 30 jours" },
  { statut: "PAR30", titre: "PAR 30", plage: "31 à 90 jours" },
  { statut: "PAR90", titre: "PAR 90", plage: "91 à 180 jours" },
  { statut: "Douteux", plage: "plus de 180 jours" },
];

const CONSTATS = [
  { icone: FileSpreadsheet, titre: "Des données éparpillées", texte: "Ventes dans un fichier Excel, paiements en espèces, Orange Money, MTN MoMo, virements : la trésorerie réelle d'une PME n'est consolidée nulle part." },
  { icone: Smartphone, titre: "Des revenus hors comptabilité", texte: "Un encaissement mobile money jamais saisi, c'est un chiffre d'affaires que ni l'entrepreneur ni son financeur ne voient." },
  { icone: EyeOff, titre: "Un risque invisible au PAR", texte: "Un emprunteur qui paie encore ses échéances mais dont le cash s'érode n'apparaît dans aucun indicateur classique." },
];

function Frise() {
  return (
    <Carte className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">La vie d'un crédit qui se dégrade</div>
        <div className="text-[11px]" style={{ color: C.muted }}>jours de retard sur échéance</div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="relative rounded-lg p-4" style={{ background: C.tealTint, border: `1.5px solid ${C.teal}` }}>
          <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: C.teal }}><ShieldAlert size={14} /> Fenêtre VIGIE</div>
          <div className="mt-1 text-sm font-semibold">À jour, signaux en baisse</div>
          <div className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>Échéances payées, mais encaissements irréguliers et score qui chute. Il est encore temps d'agir.</div>
        </div>
        {PALIERS.map((p) => { const s = STATUTS[p.statut]; return (
          <div key={p.statut} className="rounded-lg p-4" style={{ background: s.bg, border: `1px solid ${s.bd}` }}>
            <div className="text-xs font-bold" style={{ color: s.c }}>{p.titre || p.statut}</div>
            <div className="mt-1 text-sm font-semibold">{p.plage}</div>
          </div>); })}
      </div>
      {/* repères sous la frise */}
      <div className="mt-3 hidden grid-cols-[1.4fr_repeat(4,1fr)] gap-2 text-[11px] font-medium sm:grid" style={{ color: C.muted }}>
        <div className="flex items-center gap-1.5"><span className="h-px flex-1" style={{ background: C.teal }} /><span style={{ color: C.teal }}>VIGIE alerte ici</span></div>
        <div className="border-l-2 pl-2" style={{ borderColor: C.ink }}><span style={{ color: C.ink }}>1<sup>er</sup> impayé</span></div>
        <div className="border-l-2 pl-2" style={{ borderColor: C.ambre }}>le PAR le voit ici</div>
        <div />
        <div />
      </div>
    </Carte>
  );
}

export default function Constat() {
  return (
    <Section id="constat">
      <EnTete surtitre="Le constat" titre="Le PAR raconte le passé." texte="Un portefeuille se pilote au PAR 30 et au PAR 90 : des retards déjà installés. Quand un emprunteur y entre, sa trésorerie se dégrade depuis des semaines, et la marge de manœuvre a disparu." />
      <Reveal className="mt-10"><Frise /></Reveal>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CONSTATS.map(({ icone: Ic, titre, texte }, i) => (
          <Reveal key={titre} delai={i * 90}>
            <Carte className="h-full p-6">
              <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: C.tealTint }}><Ic size={18} style={{ color: C.teal }} /></div>
              <div className="mt-4 text-base font-semibold">{titre}</div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{texte}</p>
            </Carte>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
