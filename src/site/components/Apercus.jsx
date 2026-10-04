import { useState } from "react";
import { ShieldAlert, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, XCircle, Smartphone, Landmark, Banknote, Link2, Store } from "lucide-react";
import { C, CANAUX } from "../theme.js";
import { PME, PORTEFEUILLE, ANALYSE } from "../demo.js";
import { Carte, Barre } from "./ui.jsx";

/* ============================================================
   APERÇUS — reproductions fidèles des écrans de l'application,
   alimentées par les chiffres de démonstration (demo.js).
   ============================================================ */
const ton = (t) => C[t] || C.ink;
const ICONES_CANAL = { Virement: Landmark, Espèces: Banknote, "Orange Money": Smartphone, Wave: Smartphone };

export function CadreApp({ titre, icone: Ic, children, className = "" }) {
  return (
    <div className={"overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(14,27,44,0.45)] " + className} style={{ border: `1px solid ${C.hairline}`, background: C.canvas }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ background: C.ink, borderColor: C.ink2 }}>
        <span className="flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: C.ink2 }} />)}</span>
        {Ic && <Ic size={13} className="ml-2" style={{ color: "#5EEAD4" }} />}
        <span className={"truncate text-[11px] font-medium " + (Ic ? "" : "ml-2")} style={{ color: C.inkMuted }}>{titre}</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function Tuile({ label, valeur, couleur }) {
  return <Carte className="p-3"><div className="truncate text-[10px] font-medium" style={{ color: C.muted }}>{label}</div><div className="mt-0.5 font-serif text-lg font-semibold tabular-nums" style={{ color: couleur }}>{valeur}</div></Carte>;
}

function Trend({ delta }) {
  return <span className="text-xs font-semibold" style={{ color: delta < 0 ? C.rouge : C.vert }}>{delta < 0 ? "▾" : "▴+"}{delta}</span>;
}

/* ---------- Espace PME ---------- */
export function BlocTresorerie() {
  return (
    <Carte className="p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><div className="text-[11px] font-medium" style={{ color: C.muted }}>Trésorerie nette réalisée</div><div className="mt-0.5 whitespace-nowrap font-serif text-xl font-semibold tabular-nums" style={{ color: C.teal }}>{PME.realise}</div><div className="text-[10px]" style={{ color: C.muted }}>encaissé − décaissé, hors impayés</div></div>
        <div className="sm:border-l sm:pl-3" style={{ borderColor: C.hairline }}><div className="text-[11px] font-medium" style={{ color: C.muted }}>Position projetée</div><div className="mt-0.5 whitespace-nowrap font-serif text-xl font-semibold tabular-nums" style={{ color: C.teal }}>{PME.projete}</div><div className="text-[10px]" style={{ color: C.muted }}>+ créances − dettes</div></div>
      </div>
    </Carte>
  );
}

export function BlocFlux() {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PME.flux.map(([l, v, t]) => <Tuile key={l} label={l} valeur={v} couleur={ton(t)} />)}</div>;
}

export function BlocCanaux() {
  return (
    <Carte className="p-4">
      <div className="mb-3 text-sm font-semibold">D'où vient l'argent encaissé</div>
      <div className="space-y-3">
        {PME.canaux.map(([canal, montant, part]) => { const Ic = ICONES_CANAL[canal]; return (
          <div key={canal}>
            <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Ic size={14} style={{ color: CANAUX[canal] }} /> {canal}</span><span className="tabular-nums text-xs" style={{ color: C.muted }}>{montant} · {part} %</span></div>
            <div className="mt-1"><Barre valeur={part} couleur={CANAUX[canal]} /></div>
          </div>); })}
      </div>
    </Carte>
  );
}

export function ApercuTresorerie() {
  return <CadreApp titre={`Ma trésorerie — ${PME.nom}`} icone={Store}><BlocTresorerie /><BlocFlux /><BlocCanaux /></CadreApp>;
}

export function ApercuCorrespondance() {
  const requis = ["Date", "Montant (encaissé)", "Canal de paiement", "Statut", "Référence unique"];
  return (
    <CadreApp titre="Import — Correspondance des colonnes" icone={Store}>
      <div className="flex gap-1">
        <span className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white" style={{ background: C.ink }}>Ventes (14)</span>
        <span className="rounded-lg border bg-white px-3 py-1.5 text-[11px] font-medium" style={{ color: C.muted, borderColor: C.hairline }}>Dépenses (13)</span>
      </div>
      <Carte className="divide-y" style={{ borderColor: C.hairline }}>
        {PME.correspondance.map(([champ, colonne]) => (
          <div key={champ} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[150px_1fr]" style={{ borderColor: C.hairline }}>
            <div className="text-xs font-medium">{champ} {requis.includes(champ) && <span style={{ color: C.rouge }}>*</span>}</div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs" style={{ borderColor: C.hairline }}>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: C.vert }} />{colonne}</span><ChevronDown size={12} style={{ color: C.muted }} />
            </div>
          </div>
        ))}
      </Carte>
    </CadreApp>
  );
}

export function ApercuRapprochement() {
  const r = PME.rapprochement;
  return (
    <CadreApp titre="Rapprochement bancaire — relevé ajouté" icone={Store}>
      <div className="grid grid-cols-2 gap-2">{r.kpis.map(([l, v, t]) => <Tuile key={l} label={l} valeur={v} couleur={ton(t)} />)}</div>
      <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: C.rouge }} />
        <div className="text-xs font-semibold leading-relaxed" style={{ color: C.rouge }}>{r.nonEnregistre} présents sur le relevé mais absents de votre comptabilité.</div>
      </div>
      <Carte>
        <div className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: C.hairline }}>Encaissements non enregistrés</div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>
          {r.orphelins.map(([lib, canal, date, montant]) => { const Ic = ICONES_CANAL[canal]; return (
            <div key={lib} className="flex items-center gap-3 px-4 py-2.5 text-xs" style={{ borderColor: C.hairline }}>
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: CANAUX[canal] + "18" }}><Ic size={13} style={{ color: CANAUX[canal] }} /></div>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{lib}</div><div className="text-[10px]" style={{ color: C.muted }}>{canal} · {date}</div></div>
              <div className="text-right"><div className="font-semibold tabular-nums">{montant}</div><div className="flex items-center justify-end gap-1 text-[10px]" style={{ color: C.rouge }}><XCircle size={10} /> à enregistrer</div></div>
            </div>); })}
        </div>
      </Carte>
    </CadreApp>
  );
}

function Courbe({ points, couleurs, seuil }) {
  const W = 300, H = 110, x = (i) => 24 + i * ((W - 48) / (points.length - 1)), y = (v) => 86 - v * 0.76;
  const ligne = points.map(([, v], i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={"Évolution de la santé financière : " + points.map(([m, v]) => `${m} ${v}`).join(", ")}>
      <defs><linearGradient id="site-gfin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity="0.25" /><stop offset="100%" stopColor={C.teal} stopOpacity="0" /></linearGradient></defs>
      {[0, 50, 100].map((g) => <line key={g} x1="18" x2={W - 18} y1={y(g)} y2={y(g)} stroke={C.piste} strokeDasharray="3 3" />)}
      {seuil != null && <line x1="18" x2={W - 18} y1={y(seuil)} y2={y(seuil)} stroke={C.rouge} strokeDasharray="4 3" opacity="0.7" />}
      <path d={`${ligne} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#site-gfin)" />
      <path d={ligne} fill="none" stroke={C.teal} strokeWidth="2.2" strokeLinejoin="round" />
      {points.map(([m, v], i) => (
        <g key={m}>
          <circle cx={x(i)} cy={y(v)} r="3.4" fill="#fff" stroke={couleurs ? couleurs[i] : C.teal} strokeWidth="2.2" />
          <text x={x(i)} y={y(v) - 9} textAnchor="middle" fontSize="10" fontWeight="600" fill={C.ink}>{v}</text>
          <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill={C.muted}>{m}</text>
        </g>
      ))}
    </svg>
  );
}

const COULEUR_ETAT = { Sain: C.vert, Vigilance: C.ambre, "Alerte précoce": C.rouge };
const couleurSignal = (s) => (s >= 65 ? C.vert : s >= 45 ? C.or : C.rouge);
export function ApercuAnalyse() {
  const a = ANALYSE;
  return (
    <CadreApp titre={`Analyse mois par mois — ${a.entreprise}`} icone={Store}>
      <div className="rounded-xl p-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.rouge }}><ShieldAlert size={14} /> Alerte précoce : la situation se dégrade</div>
        <p className="mt-1 text-xs leading-relaxed">{a.verdict} Au rythme actuel, la trésorerie serait épuisée dans environ {a.tension} jours.</p>
      </div>
      <Carte className="p-4"><div className="flex items-baseline justify-between text-xs"><span className="font-semibold">Score mensuel</span><span style={{ color: C.muted }}>seuil d'alerte : 66</span></div><Courbe points={a.mois.map(([m, v]) => [m, v])} couleurs={a.mois.map(([, , e]) => COULEUR_ETAT[e])} seuil={66} /></Carte>
      <Carte className="overflow-x-auto p-3">
        <table className="w-full text-[10px]">
          <thead><tr style={{ color: C.muted }}><th className="pb-1 text-left font-semibold">Signal</th>{a.mois.map(([m]) => <th key={m} className="pb-1 font-semibold">{m}</th>)}</tr></thead>
          <tbody>{a.signaux.map(([nom, vals]) => (
            <tr key={nom}><td className="whitespace-nowrap py-0.5 pr-2 font-medium">{nom}</td>{vals.map((v, i) => <td key={i} className="p-0.5"><div className="rounded py-0.5 text-center font-semibold tabular-nums" style={v == null ? { background: C.piste, color: C.muted } : { background: couleurSignal(v) + "1F", color: couleurSignal(v) }}>{v ?? "n.d."}</div></td>)}</tr>))}</tbody>
        </table>
      </Carte>
    </CadreApp>
  );
}

export function ApercuFinancement() {
  return (
    <CadreApp titre="Mon financement" icone={Store}>
      <Carte className="p-4 text-center"><div className="text-[11px] font-medium" style={{ color: C.muted }}>Votre situation ce mois-ci</div><div className="mt-0.5 font-serif text-3xl font-semibold" style={{ color: C.vert }}>{PME.sante}</div></Carte>
      <Carte className="space-y-3 p-4">
        {PME.indicateurs.map(([l, v, note]) => (
          <div key={l}><div className="flex items-center justify-between text-xs"><span className="font-medium">{l}</span><span className="font-semibold" style={{ color: C.vert }}>{v} %</span></div><div className="mt-1"><Barre valeur={v} couleur={C.vert} /></div><div className="mt-0.5 text-[10px]" style={{ color: C.muted }}>{note}</div></div>
        ))}
      </Carte>
    </CadreApp>
  );
}

// interrupteurs de partage : cliquables, comme dans l'application
export function ApercuPartage() {
  const [etat, setEtat] = useState({ "Cayor Crédit": true, "Ndiambour Capital": false });
  return (
    <Carte className="p-5 shadow-[0_24px_60px_-28px_rgba(14,27,44,0.35)]">
      <div className="flex items-start gap-3"><Link2 size={18} className="mt-0.5 shrink-0" style={{ color: C.teal }} />
        <div><div className="text-sm font-semibold">Partager mon profil avec mes institutions partenaires</div><p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>Vous restez propriétaire de vos données et pouvez retirer un accès à tout moment.</p></div>
      </div>
      <div className="mt-4 space-y-2">
        {Object.entries(etat).map(([nom, on]) => (
          <div key={nom} className="flex items-center justify-between rounded-lg border p-3 transition-colors" style={{ borderColor: C.hairline, background: on ? C.tealTint : "#fff" }}>
            <div><div className="text-sm font-medium">{nom}</div><div className="text-[11px]" style={{ color: C.muted }}>{on ? "Profil partagé · en attente de validation" : "Non partagé"}</div></div>
            <button onClick={() => setEtat({ ...etat, [nom]: !on })} role="switch" aria-checked={on} aria-label={`Partager avec ${nom}`} className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: on ? C.teal : "#CBD2CC" }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 22 : 2 }} />
            </button>
          </div>
        ))}
      </div>
    </Carte>
  );
}

/* ---------- Espace Institution ---------- */
export function LigneWatchlist({ e }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-serif text-sm font-bold" style={{ background: C.tealTint, color: C.teal }}>{e.score}</div>
      <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{e.nom}</div><div className="truncate text-[10px]" style={{ color: C.muted }}>{e.secteur} · {e.region}</div></div>
      <div className="hidden text-right sm:block"><div className="text-[10px]" style={{ color: C.muted }}>stress</div><div className="font-semibold" style={{ color: C.rouge }}>J+{e.stress}</div></div>
      <div className="hidden sm:block"><Trend delta={e.delta} /></div>
      <div className="text-right"><div className="font-semibold tabular-nums">{e.ead}</div><div className="text-[10px]" style={{ color: C.muted }}>encours</div></div>
      <ChevronRight size={14} style={{ color: C.muted }} />
    </div>
  );
}

export function BlocWatchlist({ titre = "Watchlist — priorités" }) {
  return (
    <Carte>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: C.hairline }}><div className="text-xs font-semibold">{titre}</div><span className="text-[11px] font-medium" style={{ color: C.teal }}>Tout voir →</span></div>
      <div className="divide-y" style={{ borderColor: C.hairline }}>{PORTEFEUILLE.watchlist.map((e) => <LigneWatchlist key={e.nom} e={e} />)}</div>
    </Carte>
  );
}

export function ApercuPortefeuille() {
  const p = PORTEFEUILLE;
  return (
    <CadreApp titre={`Espace Institution — ${p.institution} · Portefeuille`} icone={Landmark}>
      <div className="rounded-xl p-4 sm:p-5" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.rouge }}><ShieldAlert size={15} /> Alerte précoce</div>
            <div className="mt-2 font-serif text-lg font-semibold leading-snug sm:text-xl">{p.alerte.nb} emprunteurs à jour, mais en dégradation.</div>
            <p className="mt-1 text-xs" style={{ color: C.muted }}>Ils représentent <span className="font-semibold" style={{ color: C.rouge }}>{p.alerte.exposition}</span> d'exposition invisible au PAR.</p>
          </div>
          <div><div className="text-[10px]" style={{ color: C.muted }}>Exposition sous alerte</div><div className="font-serif text-2xl font-semibold tabular-nums" style={{ color: C.rouge }}>{p.alerte.exposition}</div><div className="text-[10px]" style={{ color: C.muted }}>{p.alerte.part} de l'encours</div></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{p.kpis.map(([l, v, t]) => <Tuile key={l} label={l} valeur={v} couleur={ton(t)} />)}</div>
      <BlocWatchlist />
    </CadreApp>
  );
}
