import React, { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  UploadCloud, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  AlertTriangle, Wallet, TrendingUp, TrendingDown, Link2, Info, Table2, ShieldCheck,
  RefreshCw, ChevronRight, Landmark, Store, Smartphone, Banknote, CircleDollarSign,
  ShieldAlert, Layers, Building2, Search, Sparkles, HeartPulse, GitCompareArrows, Plus, BadgeCheck, Ban,
} from "lucide-react";

/* ============================================================
   PLATEFORME DE CRÉDIT — MVP fusionné (modèle 2)
   Une seule application :
     • Espace PME : Import → Trésorerie → Rapprochement → Financement
     • Espace Institution (VIGIE) : risque de portefeuille
   Le profil issu de l'import alimente VIGIE (consentement).
   Rapprochement : affiché depuis le fichier s'il est présent ;
   sinon, ajout optionnel d'un relevé qui active la détection d'écarts.
   Données réelles (NPM Multiservices) intégrées. Montants en FCFA.
   ============================================================ */

/* ---------- utilitaires ---------- */
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fcfa = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " FCFA";
const court = (n) => { const a = Math.abs(n), s = n < 0 ? "-" : ""; if (a >= 1e9) return s + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",") + " Md"; if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " M"; if (a >= 1e3) return s + Math.round(a / 1e3) + " k"; return s + Math.round(a); };
const pct = (x, d = 0) => (x * 100).toFixed(d).replace(".", ",") + " %";
const toISO = (v) => { if (v == null || v === "") return null; if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10); const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };

const C = { ink: "#0E1B2C", canvas: "#F5F6F4", vert: "#047857", teal: "#0F766E", ambre: "#B45309", or: "#A16207", rouge: "#B91C1C", rougeF: "#7F1D1D", muted: "#5B6472", hairline: "#E3E6E2" };
const STATUTS = { Sain: { c: C.vert, bg: "#ECFDF5", bd: "#A7F3D0" }, Arriérés: { c: C.or, bg: "#FEFCE8", bd: "#FDE68A" }, PAR30: { c: C.ambre, bg: "#FFFBEB", bd: "#FDE68A" }, PAR90: { c: C.rouge, bg: "#FEF2F2", bd: "#FECACA" }, Douteux: { c: C.rougeF, bg: "#FEF2F2", bd: "#FCA5A5" } };
const CANAUX = { "Virement": { c: "#0E1B2C", icone: Landmark }, "Espèces": { c: C.or, icone: Banknote }, "Orange Money": { c: "#F16E00", icone: Smartphone }, "MTN MoMo": { c: "#C99700", icone: Smartphone }, "Prélèvement": { c: C.teal, icone: RefreshCw }, "Autre": { c: C.muted, icone: CircleDollarSign } };
const normCanal = (v) => { const s = String(v || "").trim().toLowerCase(); if (s.includes("virement")) return "Virement"; if (s.includes("espèce") || s.includes("espece") || s.includes("cash")) return "Espèces"; if (s.includes("orange")) return "Orange Money"; if (s.includes("mtn") || s.includes("momo")) return "MTN MoMo"; if (s.includes("prélèv") || s.includes("prelev")) return "Prélèvement"; return "Autre"; };
const normStatut = (v) => { const s = String(v || "").trim().toLowerCase(); return s.startsWith("pay") ? "Payé" : s.startsWith("impay") ? "Impayé" : "Inconnu"; };
const INSTITUTIONS = [{ id: "sahel", nom: "Sahel Crédit" }, { id: "baobab", nom: "Baobab Microfinance" }, { id: "kora", nom: "Kora Capital" }];
const SEEDS = { sahel: 20261121, baobab: 55012, kora: 88133 };

/* ---------- données réelles (jeu d'exemple) ---------- */
const EX_VENTES = [
  { Date: "2026-06-02", Client: "Alimentation Barry & Frères", Produit: "Sac de riz parfumé 50 kg", Montant: 27900000, Mode: "Virement", Statut: "Payé", Clé: 46175.0001 },
  { Date: "2026-06-03", Client: "Restaurant Le Foutah", Produit: "Bidon d'huile végétale 20 L", Montant: 8500000, Mode: "Espèces", Statut: "Payé", Clé: 46176.00011 },
  { Date: "2026-06-05", Client: "Boutique Aïssatou Sow", Produit: "Sac de ciment 50 kg", Montant: 18400000, Mode: "Orange Money", Statut: "Payé", Clé: 46178.00012 },
  { Date: "2026-06-07", Client: "Ets Mamadou Diallo", Produit: "Sac de riz parfumé 50 kg", Montant: 18600000, Mode: "Virement", Statut: "Impayé", Clé: 46180.00013 },
  { Date: "2026-06-09", Client: "Sté Camara Distribution", Produit: "Carton de savon (48 pcs)", Montant: 7800000, Mode: "MTN MoMo", Statut: "Payé", Clé: 46182.00014 },
  { Date: "2026-06-11", Client: "Ets Ousmane Condé", Produit: "Prestation transport & livraison", Montant: 1250000, Mode: "Espèces", Statut: "Payé", Clé: 46184.00015 },
  { Date: "2026-06-12", Client: "Alimentation Barry & Frères", Produit: "Bidon d'huile végétale 20 L", Montant: 10200000, Mode: "Orange Money", Statut: "Payé", Clé: 46185.00016 },
  { Date: "2026-06-14", Client: "Marché Central Kindia — F. Keïta", Produit: "Sac de ciment 50 kg", Montant: 13800000, Mode: "Virement", Statut: "Impayé", Clé: 46187.00017 },
  { Date: "2026-06-16", Client: "Restaurant Le Foutah", Produit: "Contrat maintenance mensuel", Montant: 900000, Mode: "Virement", Statut: "Payé", Clé: 46189.00018 },
  { Date: "2026-06-18", Client: "Ets Mamadou Diallo", Produit: "Carton de savon (48 pcs)", Montant: 5460000, Mode: "Espèces", Statut: "Payé", Clé: 46191.00019 },
  { Date: "2026-06-20", Client: "Boutique Aïssatou Sow", Produit: "Sac de riz parfumé 50 kg", Montant: 11625000, Mode: "Orange Money", Statut: "Payé", Clé: 46193.0002 },
  { Date: "2026-06-22", Client: "Ets Ousmane Condé", Produit: "Prestation transport & livraison", Montant: 1250000, Mode: "MTN MoMo", Statut: "Payé", Clé: 46195.00021 },
  { Date: "2026-06-24", Client: "Sté Camara Distribution", Produit: "Bidon d'huile végétale 20 L", Montant: 6800000, Mode: "Virement", Statut: "Impayé", Clé: 46197.00022 },
  { Date: "2026-06-27", Client: "Alimentation Barry & Frères", Produit: "Sac de ciment 50 kg", Montant: 27600000, Mode: "Virement", Statut: "Payé", Clé: 46200.00023 },
];
const EX_DEPENSES = [
  { Date: "2026-06-01", Fournisseur: "Grands Moulins de Guinée", Libellé: "Approvisionnement riz", Montant: 22000000, Mode: "Virement", Statut: "Payé", Clé: 46174.0001 },
  { Date: "2026-06-04", Fournisseur: "Guinée Oil Distribution", Libellé: "Stock huile végétale", Montant: 14400000, Mode: "Virement", Statut: "Payé", Clé: 46177.00011 },
  { Date: "2026-06-06", Fournisseur: "Ciments de Guinée", Libellé: "Stock ciment", Montant: 15200000, Mode: "Virement", Statut: "Impayé", Clé: 46179.00012 },
  { Date: "2026-06-10", Fournisseur: "SODEFA Grossiste", Libellé: "Stock savon", Montant: 9800000, Mode: "Espèces", Statut: "Payé", Clé: 46183.00013 },
  { Date: "2026-06-05", Fournisseur: "EDG / SEG", Libellé: "Électricité EDG", Montant: 3200000, Mode: "Virement", Statut: "Payé", Clé: 46178.00014 },
  { Date: "2026-06-05", Fournisseur: "EDG / SEG", Libellé: "Eau SEG", Montant: 850000, Mode: "Virement", Statut: "Payé", Clé: 46178.00015 },
  { Date: "2026-06-03", Fournisseur: "Bailleur", Libellé: "Loyer magasin", Montant: 6000000, Mode: "Virement", Statut: "Payé", Clé: 46176.00016 },
  { Date: "2026-06-15", Fournisseur: "Orange Guinée", Libellé: "Télécom & Internet", Montant: 1400000, Mode: "Orange Money", Statut: "Payé", Clé: 46188.00017 },
  { Date: "2026-06-28", Fournisseur: null, Libellé: "Salaires du personnel", Montant: 12000000, Mode: "Virement", Statut: "Payé", Clé: 46201.00018 },
  { Date: "2026-06-12", Fournisseur: "Transports Sylla", Libellé: "Carburant & livraisons", Montant: 4800000, Mode: "Espèces", Statut: "Payé", Clé: 46185.00019 },
  { Date: "2026-06-20", Fournisseur: "Transports Sylla", Libellé: "Location camion", Montant: 2200000, Mode: "Espèces", Statut: "Payé", Clé: 46193.0002 },
  { Date: "2026-06-18", Fournisseur: null, Libellé: "Fournitures de bureau", Montant: 1500000, Mode: "Espèces", Statut: "Payé", Clé: 46191.00021 },
  { Date: "2026-06-25", Fournisseur: null, Libellé: "Frais bancaires & taxes", Montant: 2100000, Mode: "Prélèvement", Statut: "Payé", Clé: 46198.00022 },
];
// rapprochement présent dans le fichier réel
const EX_RECON = {
  comptes: [
    { compte: "Banque (521)", canal: "Virement", comptable: 45850000, releve: 46150000 },
    { compte: "Orange Money (5211)", canal: "Orange Money", comptable: 43825000, releve: 43675000 },
  ],
  lettrage: [
    { date: "2026-06-07", tiers: "Ets Mamadou Diallo", piece: "VT-004 ↔ RG-014", montant: 18600000, statut: "Lettré", ecart: 0 },
    { date: "2026-06-14", tiers: "Marché Central Kindia", piece: "VT-008", montant: 13800000, statut: "Non lettré", ecart: 13800000 },
    { date: "2026-06-06", tiers: "Ciments de Guinée", piece: "AC-003", montant: 15200000, statut: "Non lettré", ecart: -15200000 },
  ],
};

/* ---------- import : mapping, lecture, validation ---------- */
const SYN = { date: ["date"], montant: ["montant", "ttc"], canal: ["mode", "moyen", "canal", "paiement"], statut: ["statut", "état", "etat"], tiers: ["client", "fournisseur", "tiers"], libelle: ["libellé", "libelle", "produit", "désignation"], ref: ["clé", "cle", "référence", "reference", "ref", "pièce", "piece"] };
function autoMap(cols) { const m = {}; for (const [k, ss] of Object.entries(SYN)) m[k] = cols.find((c) => ss.some((s) => String(c).trim().toLowerCase() === s)) || cols.find((c) => ss.some((s) => String(c).trim().toLowerCase().includes(s))) || ""; return m; }
function lireFeuille(ws) {
  const g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null, blankrows: false });
  let h = -1; for (let i = 0; i < Math.min(g.length, 20); i++) if ((g[i] || []).some((c) => String(c).trim().toLowerCase() === "date")) { h = i; break; }
  if (h < 0) return null;
  const ent = g[h].map((c) => (c == null ? "" : String(c).trim()));
  const di = ent.findIndex((e) => e.toLowerCase() === "date"); const lignes = [];
  for (let i = h + 1; i < g.length; i++) { const row = g[i] || []; if (row[di] == null || row[di] === "") continue; const o = {}; ent.forEach((e, j) => { if (e) o[e] = row[j]; }); lignes.push(o); }
  return { colonnes: ent.filter(Boolean), lignes };
}
function valider(lignes, m, sens) {
  const vus = new Set(); const valides = [], rejets = [];
  for (const l of lignes) {
    const date = toISO(l[m.date]); const montant = Number(String(l[m.montant]).replace(/\s/g, "").replace(",", "."));
    const ref = l[m.ref] != null ? String(l[m.ref]) : `${date}-${montant}`;
    if (!date) { rejets.push({ l, raison: "date invalide" }); continue; }
    if (!isFinite(montant) || montant <= 0) { rejets.push({ l, raison: "montant invalide" }); continue; }
    if (vus.has(ref)) { rejets.push({ l, raison: "doublon" }); continue; } vus.add(ref);
    valides.push({ sens, date, montant, ref, canal: normCanal(l[m.canal]), statut: normStatut(l[m.statut]), tiers: l[m.tiers] || "—", libelle: l[m.libelle] || "" });
  }
  return { valides, rejets };
}
function calculerProfil(E, S) {
  const s = (a, f) => a.filter(f).reduce((x, y) => x + y.montant, 0);
  const encaisse = s(E, (e) => e.statut === "Payé"), creances = s(E, (e) => e.statut === "Impayé");
  const decaisse = s(S, (e) => e.statut === "Payé"), dettes = s(S, (e) => e.statut === "Impayé");
  const ventesTotal = encaisse + creances;
  const parCanal = {}; E.filter((e) => e.statut === "Payé").forEach((e) => parCanal[e.canal] = (parCanal[e.canal] || 0) + e.montant);
  const canaux = Object.entries(parCanal).map(([canal, montant]) => ({ canal, montant, part: montant / (encaisse || 1) })).sort((a, b) => b.montant - a.montant);
  const chargesFixes = s(S, (e) => /loyer|salaire/i.test(e.libelle));
  const taux = ventesTotal ? encaisse / ventesTotal : 0;
  const marge = ventesTotal ? (ventesTotal - (decaisse + dettes)) / ventesTotal : 0;
  const poidsFixe = ventesTotal ? chargesFixes / ventesTotal : 0;
  return { encaisse, creances, decaisse, dettes, ventesTotal, realise: encaisse - decaisse, projete: encaisse - decaisse + creances - dettes, canaux, taux, marge, poidsFixe };
}
// score de bancabilité dérivé de la santé du mois (pour VIGIE)
function scoreDepuisProfil(p) {
  const clamp = (x) => Math.max(0, Math.min(100, x));
  return Math.round(clamp(0.35 * (p.taux * 100) + 0.40 * Math.min(100, p.marge * 200) + 0.25 * (100 - Math.min(100, p.poidsFixe * 250))));
}
// historique sur 4 mois : juin = données réelles ; mois précédents = reconstruits (même structure)
function genererHistorique(pJuin) {
  const specs = [
    { mois: "Mars", taux: 0.68, marge: 0.34, poidsFixe: 0.14, f: 0.84 },
    { mois: "Avril", taux: 0.60, marge: 0.24, poidsFixe: 0.17, f: 0.74 },
    { mois: "Mai", taux: 0.73, marge: 0.38, poidsFixe: 0.13, f: 0.93 },
    { mois: "Juin", taux: pJuin.taux, marge: pJuin.marge, poidsFixe: pJuin.poidsFixe, reel: true },
  ];
  return specs.map((m) => ({ mois: m.mois, score: scoreDepuisProfil(m), ventes: m.reel ? pJuin.ventesTotal : Math.round(pJuin.ventesTotal * m.f), reel: !!m.reel }));
}

/* ---------- rapprochement Branch B : relevé ajouté ---------- */
function genererReleveExemple(E) {
  // relevé bancaire/mobile d'exemple, dérivé des ventes encaissées (hors espèces) + anomalies réalistes
  const bancaires = E.filter((e) => e.statut === "Payé" && e.canal !== "Espèces");
  const releve = [];
  bancaires.forEach((e, i) => {
    if (i === 3) return;                          // omission : encaissement présent en compta mais absent du relevé → à vérifier
    const frais = e.canal.includes("Money") ? Math.round(e.montant * 0.01) : 0;
    releve.push({ date: e.date, montant: e.montant - frais, canal: e.canal, libelle: e.tiers, frais });
  });
  // 2 crédits présents au relevé mais jamais comptabilisés (revenus non enregistrés)
  releve.push({ date: "2026-06-08", montant: 4200000, canal: "Orange Money", libelle: "Encaissement non identifié", frais: 0 });
  releve.push({ date: "2026-06-19", montant: 2650000, canal: "Virement", libelle: "Virement reçu non rapproché", frais: 0 });
  return releve;
}
function rapprocher(E, releve) {
  const compta = E.filter((e) => e.statut === "Payé" && e.canal !== "Espèces").map((e) => ({ ...e, pris: false }));
  const rel = releve.map((r) => ({ ...r, pris: false }));
  const paires = [];
  for (const r of rel) {
    let best = null, bs = 0;
    for (const c of compta) {
      if (c.pris) continue;
      const dm = Math.abs(c.montant - r.montant) / Math.max(r.montant, 1); if (dm > 0.03) continue;
      const dj = Math.abs((new Date(c.date) - new Date(r.date)) / 86400000); if (dj > 3) continue;
      const score = (1 - dm / 0.03) * 0.6 + (1 - dj / 3) * 0.4;
      if (score > bs) { bs = score; best = c; }
    }
    if (best && bs >= 0.5) { best.pris = true; r.pris = true; paires.push({ releve: r, compta: best, ecart: r.montant - best.montant }); }
  }
  const releveOrphelins = rel.filter((r) => !r.pris);        // au relevé, pas en compta → revenu non enregistré
  const comptaOrphelins = compta.filter((c) => !c.pris);     // en compta, pas au relevé → à vérifier
  const montantNonEnreg = releveOrphelins.reduce((a, r) => a + r.montant, 0);
  const taux = compta.length ? (compta.length - comptaOrphelins.length) / compta.length : 0;
  return { paires, releveOrphelins, comptaOrphelins, montantNonEnreg, taux, nbCompta: compta.length, nbReleve: rel.length };
}

/* ---------- portefeuille VIGIE ---------- */
const SECT = ["Commerce & distribution", "Agro-alimentaire", "Transport & logistique", "Import-export", "Services", "BTP", "Artisanat"];
const REG = ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Conakry", "Kankan", "Kindia"];
const PRE = ["Ets", "Sarl", "Groupe", "Cie", "Ste"];
const ROOT = ["Teranga", "Baraka", "Djoliba", "Fouta", "Sahel", "Yaakaar", "Jappoo", "Bamtaare", "Ndakaaru", "Kankou", "Faso", "Niani", "Kéné", "Wakat", "Diarama", "Mansa", "Kora", "Nimba", "Bani", "Sankofa"];
const ACT = ["Négoce", "Trading", "Logistique", "Agro", "Services", "Distribution", "Commerce", "Bâtiment", "Import", "Transit"];
function genererPortefeuille(seed) {
  const r = rng(seed); const arr = [];
  for (let i = 1; i < 48; i++) {
    const nom = `${PRE[Math.floor(r() * PRE.length)]} ${ROOT[Math.floor(r() * ROOT.length)]} ${ACT[Math.floor(r() * ACT.length)]}`;
    const secteur = SECT[Math.floor(r() * SECT.length)], region = REG[Math.floor(r() * REG.length)];
    const ead = Math.round((2 + Math.pow(r(), 2.3) * 118) * 1e6 / 5e5) * 5e5, taux = 0.09 + r() * 0.09, anciennete = 2 + Math.floor(r() * 46);
    let score = Math.round(38 + r() * 52); const chute = r() < 0.36; const scoreDelta = chute ? -(11 + Math.round(r() * 17)) : Math.round(-4 + r() * 9);
    const risk = (100 - score) / 100, u = r(); let dpd = 0;
    if (u < risk * 0.75) { const sv = r(); if (sv < 0.22) dpd = 121 + Math.floor(r() * 160); else if (sv < 0.55) dpd = 31 + Math.floor(r() * 90); else dpd = 1 + Math.floor(r() * 30); }
    let statut = "Sain"; if (dpd > 180) statut = "Douteux"; else if (dpd > 90) statut = "PAR90"; else if (dpd > 30) statut = "PAR30"; else if (dpd > 0) statut = "Arriérés";
    const ap = dpd === 0 && scoreDelta <= -11 && score < 66; const js = ap ? Math.max(12, Math.round(60 + scoreDelta * 2 + (score - 45))) : null;
    const pd = Math.max(0.02, Math.min(0.6, 0.02 + risk * 0.42 + (dpd > 30 ? 0.15 : 0)));
    arr.push({ id: i, nom, secteur, region, ead, taux, anciennete, score, scoreDelta, dpd, statut, alertePrecoce: ap, joursAvantStress: js, pd, lgd: 0.45, ecl: ead * pd * 0.45 });
  }
  return arr;
}
// la PME importée, construite en emprunteur-vedette (candidate puis validée par une institution)
function construireVedette(profil, nomFocus) {
  const histo = genererHistorique(profil);
  const sc = histo[histo.length - 1].score;
  const scoreDelta = sc - histo[histo.length - 2].score;
  const pd = Math.max(0.02, Math.min(0.6, 0.02 + (100 - sc) / 100 * 0.42));
  return { id: 0, isFocus: true, nom: nomFocus, secteur: "Commerce & distribution", region: "Conakry", ead: 28000000, taux: 0.14, anciennete: 19, score: sc, scoreDelta, dpd: 0, statut: "Sain", alertePrecoce: false, joursAvantStress: null, pd, lgd: 0.45, ecl: 28000000 * pd * 0.45, profil, histo };
}
function agreger(pf) {
  const enc = pf.reduce((a, e) => a + e.ead, 0); const exp = (f) => pf.filter(f).reduce((a, e) => a + e.ead, 0);
  const watchlist = pf.filter((e) => e.alertePrecoce).sort((a, b) => (b.ead * -b.scoreDelta) - (a.ead * -a.scoreDelta));
  return {
    encoursTotal: enc, par30: exp((e) => e.dpd > 30) / enc, par90: exp((e) => e.dpd > 90) / enc,
    eclTotal: pf.reduce((a, e) => a + e.ecl, 0), coutRisque: pf.reduce((a, e) => a + e.ecl, 0) / enc,
    watchlist, expoAlerte: watchlist.reduce((a, e) => a + e.ead, 0),
    parSecteur: SECT.map((s) => ({ nom: s.split(" ")[0], encours: exp((e) => e.secteur === s) })).sort((a, b) => b.encours - a.encours),
    parStatut: Object.keys(STATUTS).map((s) => ({ statut: s, encours: exp((e) => e.statut === s), nb: pf.filter((e) => e.statut === s).length })),
  };
}

/* ============================================================ COMPOSANTS ============================================================ */
function Carte({ children, className = "", style = {} }) { return <div className={"rounded-xl bg-white " + className} style={{ border: `1px solid ${C.hairline}`, ...style }}>{children}</div>; }
function Barre({ valeur, couleur }) { return <div className="h-2 w-full rounded-full" style={{ background: "#EEF0ED" }}><div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, valeur))}%`, background: couleur }} /></div>; }
function StatutChip({ statut, petit }) { const s = STATUTS[statut]; return <span className={"inline-flex items-center rounded-full font-semibold " + (petit ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")} style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}` }}>{statut}</span>; }
function Trend({ delta }) { const neg = delta < 0; return <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: neg ? C.rouge : C.vert }}>{neg ? "▾" : "▴"}{neg ? "" : "+"}{delta}</span>; }
function Vide({ icone: Ic, titre, texte, action, onAction }) {
  return <Carte className="flex flex-col items-center p-10 text-center"><Ic size={30} style={{ color: C.teal }} /><div className="mt-3 text-sm font-semibold">{titre}</div><div className="mt-1 max-w-sm text-sm" style={{ color: C.muted }}>{texte}</div>{action && <button onClick={onAction} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}>{action}</button>}</Carte>;
}

/* ============================================================ APP ============================================================ */
export default function App() {
  const [espace, setEspace] = useState("pme");
  const [pmeVue, setPmeVue] = useState("import");
  const [instVue, setInstVue] = useState("board");
  const [sel, setSel] = useState(null);
  const [instActive, setInstActive] = useState("sahel");
  const [partages, setPartages] = useState(["sahel", "kora"]);
  const [valides, setValides] = useState({});
  const [rejetes, setRejetes] = useState({});
  const [source, setSource] = useState(null);
  const [mapV, setMapV] = useState(null); const [mapD, setMapD] = useState(null);
  const [impEtape, setImpEtape] = useState(0);
  const [releveAjoute, setReleveAjoute] = useState(null);

  const chargerExemple = useCallback((avecRapprochement) => {
    const ventes = { colonnes: Object.keys(EX_VENTES[0]), lignes: EX_VENTES };
    const depenses = { colonnes: Object.keys(EX_DEPENSES[0]), lignes: EX_DEPENSES };
    setSource({ nom: avecRapprochement ? "NPM Multiservices — fichier complet" : "NPM Multiservices — export sans rapprochement", ventes, depenses, recon: avecRapprochement ? EX_RECON : null });
    setMapV(autoMap(ventes.colonnes)); setMapD(autoMap(depenses.colonnes));
    setReleveAjoute(null); setImpEtape(1);
  }, []);
  const chargerFichier = useCallback(async (file) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const findSheet = (kw) => { for (const k of kw) { const n = wb.SheetNames.find((s) => s.toLowerCase().includes(k)); if (n) return wb.Sheets[n]; } return null; };
      let ventes = null; const vs = findSheet(["vente", "encaiss"]); if (vs) ventes = lireFeuille(vs);
      if (!ventes) for (const s of wb.SheetNames) { const f = lireFeuille(wb.Sheets[s]); if (f) { ventes = f; break; } }
      if (!ventes) return;
      const ds = findSheet(["dépense", "depense", "achat", "charge"]); const depenses = ds ? lireFeuille(ds) : { colonnes: ventes.colonnes, lignes: [] };
      const aRappro = wb.SheetNames.some((s) => /rappro|relev|lettr/i.test(s));
      setSource({ nom: file.name, ventes, depenses, recon: aRappro ? { comptes: [], lettrage: [], detecteSansDetail: true } : null });
      setMapV(autoMap(ventes.colonnes)); setMapD(autoMap(depenses.colonnes)); setReleveAjoute(null); setImpEtape(1);
    } catch (e) { /* ignoré */ }
  }, []);

  const resultat = useMemo(() => {
    if (!source || !mapV) return null;
    const v = valider(source.ventes.lignes, mapV, "ENTREE");
    const d = source.depenses.lignes.length && mapD ? valider(source.depenses.lignes, mapD, "SORTIE") : { valides: [], rejets: [] };
    return { entrees: v.valides, sorties: d.valides, rejets: [...v.rejets, ...d.rejets], profil: calculerProfil(v.valides, d.valides), nbValides: v.valides.length + d.valides.length, nbLignes: source.ventes.lignes.length + source.depenses.lignes.length };
  }, [source, mapV, mapD]);

  const hasReleve = !!source?.recon;
  const profil = resultat?.profil || null;
  const nomFocus = source ? source.nom.split("—")[0].trim() : "";
  const instNom = INSTITUTIONS.find((i) => i.id === instActive).nom;
  const vedette = useMemo(() => (profil ? construireVedette(profil, nomFocus) : null), [profil, nomFocus]);
  const book = useMemo(() => genererPortefeuille(SEEDS[instActive]), [instActive]);
  const partageActive = !!vedette && partages.includes(instActive);
  const vedetteValidee = (valides[instActive] || []).includes(0);
  const estEcarte = (rejetes[instActive] || []).includes(0);
  const candidats = partageActive && !vedetteValidee && !estEcarte ? [vedette] : [];
  const portefeuille = useMemo(() => (partageActive && vedetteValidee ? [vedette, ...book] : book), [partageActive, vedetteValidee, vedette, book]);
  const agg = useMemo(() => agreger(portefeuille), [portefeuille]);
  const selE = sel != null ? (vedette && vedette.id === sel ? vedette : book.find((e) => e.id === sel)) : null;
  const validerPME = (id) => setValides((v) => ({ ...v, [instActive]: [...(v[instActive] || []), id] }));
  const ecarterPME = (id) => setRejetes((v) => ({ ...v, [instActive]: [...(v[instActive] || []), id] }));

  const importe = impEtape >= 3 && !!resultat;
  const ajouterReleve = () => setReleveAjoute(rapprocher(resultat.entrees, genererReleveExemple(resultat.entrees)));

  return (
    <div style={{ background: C.canvas, minHeight: "100vh", color: C.ink }} className="font-sans antialiased">
      <header style={{ background: C.ink }} className="px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: C.teal }}>{espace === "pme" ? <Store size={18} /> : <Landmark size={18} />}</div>
            <div><div className="text-[15px] font-bold leading-tight">{espace === "pme" ? (importe ? nomFocus : "Espace PME") : instNom}</div>
              <div className="text-[11px]" style={{ color: "#9AA7B8" }}>{espace === "pme" ? "Trésorerie & financement" : "VIGIE — risque de portefeuille"}</div></div>
            {espace === "inst" && (<select value={instActive} onChange={(e) => { setInstActive(e.target.value); setSel(null); }} className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-white outline-none" style={{ background: "#1C2E44" }}>{INSTITUTIONS.map((i) => <option key={i.id} value={i.id} style={{ color: C.ink }}>{i.nom}</option>)}</select>)}
          </div>
          <div className="flex rounded-lg p-1" style={{ background: "#1C2E44" }}>
            {[["pme", "Espace PME", Store], ["inst", "Espace Institution", Landmark]].map(([id, lbl, Ic]) => (
              <button key={id} onClick={() => { setEspace(id); setSel(null); }} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: espace === id ? "#fff" : "transparent", color: espace === id ? C.ink : "#9AA7B8" }}><Ic size={14} /><span className="hidden sm:inline">{lbl}</span></button>
            ))}
          </div>
        </div>
      </header>

      {!selE && (
        <nav className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur" style={{ borderColor: C.hairline }}>
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-8">
            {(espace === "pme"
              ? [["import", "Import", UploadCloud], ["tresorerie", "Ma trésorerie", HeartPulse], ["rapprochement", "Rapprochement", GitCompareArrows], ["financement", "Mon financement", ShieldCheck]]
              : [["board", "Portefeuille", Layers], ["valider", "À valider", BadgeCheck], ["watch", "Alerte précoce", ShieldAlert], ["liste", "Emprunteurs", Building2]]
            ).map(([id, lbl, Ic]) => { const actif = (espace === "pme" ? pmeVue : instVue) === id; return (
              <button key={id} onClick={() => espace === "pme" ? setPmeVue(id) : setInstVue(id)} className="flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: actif ? C.ink : C.muted, borderBottom: `2px solid ${actif ? C.teal : "transparent"}` }}>
                <Ic size={16} /> {lbl}
                {id === "watch" && agg.watchlist.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.rouge }}>{agg.watchlist.length}</span>}
                {id === "import" && importe && <CheckCircle2 size={13} style={{ color: C.vert }} />}
                {id === "valider" && candidats.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.ambre }}>{candidats.length}</span>}
              </button>); })}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {espace === "pme" ? (
          pmeVue === "import" ? <Import source={source} mapV={mapV} setMapV={setMapV} mapD={mapD} setMapD={setMapD} resultat={resultat} etape={impEtape} setEtape={setImpEtape} onExemple={chargerExemple} onFichier={chargerFichier} onReset={() => { setSource(null); setImpEtape(0); setReleveAjoute(null); }} goVue={setPmeVue} />
            : pmeVue === "tresorerie" ? (importe ? <Tresorerie profil={profil} /> : <PromptImport goImport={() => setPmeVue("import")} />)
              : pmeVue === "rapprochement" ? (importe ? <Rapprochement hasReleve={hasReleve} recon={source.recon} releveAjoute={releveAjoute} onAjouter={ajouterReleve} /> : <PromptImport goImport={() => setPmeVue("import")} />)
                : (importe ? <Financement profil={profil} institutions={INSTITUTIONS} partages={partages} setPartages={setPartages} valides={valides} /> : <PromptImport goImport={() => setPmeVue("import")} />)
        ) : selE ? <Fiche e={selE} partageActive={!selE.isFocus || partageActive} estCandidat={selE.isFocus && candidats.length > 0} onValider={() => { validerPME(0); setSel(null); setInstVue("liste"); }} onEcarter={() => { ecarterPME(0); setSel(null); }} onBack={() => setSel(null)} />
          : instVue === "board" ? <Board agg={agg} setVue={setInstVue} onOpen={setSel} candidatsCount={candidats.length} instNom={instNom} />
            : instVue === "valider" ? <AValider candidats={candidats} onOpen={setSel} onValider={(id) => validerPME(id)} onEcarter={(id) => ecarterPME(id)} instNom={instNom} />
            : instVue === "watch" ? <Watch agg={agg} onOpen={setSel} />
              : <Liste portefeuille={portefeuille} onOpen={setSel} />}
      </main>

    </div>
  );
}

function PromptImport({ goImport }) { return <Vide icone={UploadCloud} titre="Importez d'abord vos données" texte="Cet écran s'appuie sur votre fichier de gestion. Passez par l'onglet Import pour connecter vos ventes et dépenses." action="Aller à l'import" onAction={goImport} />; }

/* ============================================================ IMPORT (4 étapes) ============================================================ */
const CHAMPS = [["date", "Date", true], ["montant", "Montant (encaissé)", true], ["canal", "Canal de paiement", true], ["statut", "Statut", true], ["tiers", "Contrepartie", false], ["libelle", "Libellé", false], ["ref", "Référence unique", true]];
const ETAPES = ["Dépôt", "Correspondance", "Validation", "Profil"];
function Import({ source, mapV, setMapV, mapD, setMapD, resultat, etape, setEtape, onExemple, onFichier, onReset, goVue }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {ETAPES.map((e, i) => (<React.Fragment key={e}>
          <div className="flex items-center gap-2"><div className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: i <= etape ? C.teal : "#EEF0ED", color: i <= etape ? "#fff" : C.muted }}>{i < etape ? "✓" : i + 1}</div><span className="hidden text-xs font-medium sm:inline" style={{ color: i <= etape ? C.ink : C.muted }}>{e}</span></div>
          {i < 3 && <div className="h-px w-5 sm:w-8" style={{ background: C.hairline }} />}
        </React.Fragment>))}
      </div>

      {etape === 0 && <Depot onFichier={onFichier} onExemple={onExemple} />}
      {etape === 1 && source && <Correspondance source={source} mapV={mapV} setMapV={setMapV} mapD={mapD} setMapD={setMapD} onBack={() => { onReset(); }} onNext={() => setEtape(2)} />}
      {etape === 2 && resultat && <Validation resultat={resultat} onBack={() => setEtape(1)} onNext={() => setEtape(3)} />}
      {etape === 3 && resultat && <ProfilImport resultat={resultat} onBack={() => setEtape(2)} onReset={onReset} goVue={goVue} />}
    </div>
  );
}
function Depot({ onFichier, onExemple }) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Importez votre fichier de gestion</h2></div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFichier(e.dataTransfer.files[0]); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: drag ? C.teal : C.hairline, background: drag ? "#F0F5F4" : "#fff" }}>
        <UploadCloud size={32} style={{ color: C.teal }} /><div className="mt-3 text-sm font-semibold">Glissez-déposez votre fichier ici</div>
        <div className="mt-1 text-xs" style={{ color: C.muted }}>ou cliquez pour parcourir · .xlsx, .xlsm, .csv</div>
        <input type="file" accept=".xlsx,.xlsm,.csv" className="hidden" onChange={(e) => e.target.files[0] && onFichier(e.target.files[0])} /></label>
      <div className="flex items-center gap-3"><div className="h-px flex-1" style={{ background: C.hairline }} /><span className="text-xs" style={{ color: C.muted }}>ou</span><div className="h-px flex-1" style={{ background: C.hairline }} /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={() => onExemple(true)} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-[#FAFBFA]" style={{ borderColor: C.hairline }}>
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: "#F0F5F4" }}><FileSpreadsheet size={18} style={{ color: C.teal }} /></div>
          <div><div className="text-sm font-semibold">Fichier complet</div><div className="text-xs" style={{ color: C.muted }}>avec rapprochement bancaire intégré</div></div></button>
        <button onClick={() => onExemple(false)} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-[#FAFBFA]" style={{ borderColor: C.hairline }}>
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: "#F0F5F4" }}><Table2 size={18} style={{ color: C.ambre }} /></div>
          <div><div className="text-sm font-semibold">Export sans rapprochement</div><div className="text-xs" style={{ color: C.muted }}>ventes + dépenses seules</div></div></button>
      </div>
    </div>
  );
}
function Correspondance({ source, mapV, setMapV, mapD, setMapD, onBack, onNext }) {
  const [tab, setTab] = useState("ventes");
  const courant = tab === "ventes" ? source.ventes : source.depenses; const mapping = tab === "ventes" ? mapV : mapD; const setMap = tab === "ventes" ? setMapV : setMapD;
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Correspondance des colonnes</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Chaque champ requis est relié à une colonne de votre fichier. Détection automatique — corrigez si besoin. C'est ce mapping qui rend l'outil compatible avec n'importe quel format.</p></div>
      <div className="text-xs" style={{ color: C.muted }}>Source : <span className="font-medium" style={{ color: C.ink }}>{source.nom}</span></div>
      {source.depenses.lignes.length > 0 && <div className="flex gap-1">{[["ventes", `Ventes (${source.ventes.lignes.length})`], ["depenses", `Dépenses (${source.depenses.lignes.length})`]].map(([id, lbl]) => (<button key={id} onClick={() => setTab(id)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: tab === id ? C.ink : "#fff", color: tab === id ? "#fff" : C.muted, border: `1px solid ${C.hairline}` }}>{lbl}</button>))}</div>}
      <Carte className="divide-y" style={{ borderColor: C.hairline }}>
        {CHAMPS.map(([cle, lbl, req]) => (<div key={cle} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[220px_1fr]">
          <div className="text-sm font-medium">{lbl} {req && <span style={{ color: C.rouge }}>*</span>}</div>
          <select value={mapping[cle] || ""} onChange={(e) => setMap({ ...mapping, [cle]: e.target.value })} className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: mapping[cle] ? C.hairline : "#FCA5A5" }}>
            <option value="">— non mappé —</option>{courant.colonnes.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>))}
      </Carte>
      <div className="flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <button onClick={onNext} disabled={!mapV.date || !mapV.montant} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.ink }}>Valider <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
function Validation({ resultat, onBack, onNext }) {
  const { nbLignes, nbValides, rejets } = resultat;
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Validation</h2></div>
      <div className="grid grid-cols-3 gap-4">
        <Carte className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>Lignes lues</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums">{nbLignes}</div></Carte>
        <Carte className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>Valides</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: C.vert }}>{nbValides}</div></Carte>
        <Carte className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>Rejetées</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: rejets.length ? C.rouge : C.muted }}>{rejets.length}</div></Carte>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <button onClick={onNext} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}>Voir le profil <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
function ProfilImport({ resultat, onBack, onReset, goVue }) {
  const p = resultat.profil;
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Profil calculé sur vos données</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Vos chiffres, avec l'argent réellement encaissé distingué de ce qui reste à recevoir.</p></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Encaissé (réel)", court(p.encaisse), C.vert], ["À recevoir", court(p.creances), C.ambre], ["Décaissé (réel)", court(p.decaisse), C.rouge], ["À payer", court(p.dettes), C.or]].map(([l, v, c], i) => (
          <Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: "#F0F5F4", border: `1px solid ${C.hairline}` }}>
        <CheckCircle2 size={18} style={{ color: C.vert }} /><div className="text-sm"><span className="font-semibold">Import terminé.</span></div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <div className="flex gap-2">
          <button onClick={onReset} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: C.hairline }}><RefreshCw size={14} /> Autre fichier</button>
          <button onClick={() => goVue("tresorerie")} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}>Voir ma trésorerie <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PME : TRÉSORERIE ============================================================ */
function Tresorerie({ profil: p }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Ma trésorerie</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Ce qui est réellement entré, ce qui reste à encaisser, et votre position si tout se règle.</p></div>
      <Carte className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><div className="text-xs font-medium" style={{ color: C.muted }}>Trésorerie nette réalisée (mois)</div><div className="mt-1 font-serif text-3xl font-semibold tabular-nums" style={{ color: p.realise >= 0 ? C.teal : C.rouge }}>{fcfa(p.realise)}</div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>encaissé − décaissé, hors impayés</div></div>
          <div className="sm:border-l sm:pl-4" style={{ borderColor: C.hairline }}><div className="text-xs font-medium" style={{ color: C.muted }}>Position projetée</div><div className="mt-1 font-serif text-3xl font-semibold tabular-nums" style={{ color: p.projete >= 0 ? C.teal : C.rouge }}>{fcfa(p.projete)}</div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>+ créances à encaisser − dettes à payer</div></div>
        </div>
      </Carte>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Encaissé", court(p.encaisse), C.vert, TrendingUp], ["À recevoir", court(p.creances), C.ambre, RefreshCw], ["Décaissé", court(p.decaisse), C.rouge, TrendingDown], ["À payer", court(p.dettes), C.or, RefreshCw]].map(([l, v, c, Ic], i) => (
          <Carte key={i} className="p-4"><div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: C.muted }}><Ic size={13} /> {l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      <Carte className="p-5">
        <div className="mb-3 text-sm font-semibold">D'où vient l'argent encaissé</div>
        <div className="space-y-3">{p.canaux.map((c) => { const cfg = CANAUX[c.canal] || CANAUX["Autre"]; const Ic = cfg.icone; return (
          <div key={c.canal}><div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Ic size={14} style={{ color: cfg.c }} /> {c.canal}</span><span className="tabular-nums" style={{ color: C.muted }}>{court(c.montant)} · {pct(c.part)}</span></div><div className="mt-1"><Barre valeur={c.part * 100} couleur={cfg.c} /></div></div>); })}
        </div>
      </Carte>
    </div>
  );
}

/* ============================================================ PME : RAPPROCHEMENT (conditionnel) ============================================================ */
function Rapprochement({ hasReleve, recon, releveAjoute, onAjouter }) {
  // Branche A : rapprochement présent dans le fichier
  if (hasReleve) {
    if (recon.detecteSansDetail) {
      return (<div className="space-y-4"><EnTeteRappro /><Carte className="flex items-start gap-3 p-5"><CheckCircle2 size={18} style={{ color: C.vert, marginTop: 1 }} /><div className="text-sm"><span className="font-semibold">Rapprochement détecté dans votre fichier.</span></div></Carte></div>);
    }
    const totC = recon.comptes.reduce((a, c) => a + c.comptable, 0), totR = recon.comptes.reduce((a, c) => a + c.releve, 0);
    return (
      <div className="space-y-5">
        <EnTeteRappro />
        <Carte>
          <div className="border-b px-5 py-3 text-sm font-semibold" style={{ borderColor: C.hairline }}>Solde comptable vs relevé bancaire</div>
          <div className="divide-y" style={{ borderColor: C.hairline }}>
            {recon.comptes.map((c, i) => { const ecart = c.releve - c.comptable; return (
              <div key={i} className="grid grid-cols-2 items-center gap-2 px-5 py-3 text-sm sm:grid-cols-4">
                <div className="font-medium">{c.compte}</div>
                <div className="text-right tabular-nums sm:text-left"><div className="text-[10px]" style={{ color: C.muted }}>comptable</div>{court(c.comptable)}</div>
                <div className="text-right tabular-nums sm:text-left"><div className="text-[10px]" style={{ color: C.muted }}>relevé</div>{court(c.releve)}</div>
                <div className="text-right tabular-nums"><div className="text-[10px]" style={{ color: C.muted }}>écart</div><span style={{ color: ecart === 0 ? C.muted : ecart > 0 ? C.ambre : C.rouge, fontWeight: 600 }}>{ecart > 0 ? "+" : ""}{court(ecart)}</span></div>
              </div>); })}
            <div className="grid grid-cols-2 items-center gap-2 px-5 py-3 text-sm sm:grid-cols-4" style={{ background: "#FAFBFA" }}>
              <div className="font-semibold">Total trésorerie</div>
              <div className="text-right tabular-nums font-semibold sm:text-left">{court(totC)}</div>
              <div className="text-right tabular-nums font-semibold sm:text-left">{court(totR)}</div>
              <div className="text-right tabular-nums font-semibold" style={{ color: (totR - totC) ? C.ambre : C.muted }}>{totR - totC > 0 ? "+" : ""}{court(totR - totC)}</div>
            </div>
          </div>
        </Carte>
        <Carte>
          <div className="border-b px-5 py-3 text-sm font-semibold" style={{ borderColor: C.hairline }}>Lettrage — écritures pointées</div>
          <div className="divide-y" style={{ borderColor: C.hairline }}>
            {recon.lettrage.map((l, i) => { const ok = l.statut === "Lettré"; return (
              <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                {ok ? <CheckCircle2 size={16} style={{ color: C.vert }} /> : <AlertTriangle size={16} style={{ color: C.ambre }} />}
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.tiers}</div><div className="text-[11px]" style={{ color: C.muted }}>{l.piece} · {l.date}</div></div>
                <div className="text-right"><div className="font-semibold tabular-nums">{court(l.montant)}</div><div className="text-[11px]" style={{ color: ok ? C.vert : C.ambre }}>{l.statut}</div></div>
              </div>); })}
          </div>
        </Carte>
      </div>
    );
  }

  // Branche B : pas de rapprochement → option d'ajout
  return (
    <div className="space-y-5">
      <EnTeteRappro />
      {!releveAjoute ? (
        <Carte className="flex flex-col items-center p-8 text-center">
          <GitCompareArrows size={30} style={{ color: C.ambre }} />
          <div className="mt-3 text-sm font-semibold">Rapprochement indisponible</div>
          <div className="mt-1 max-w-md text-sm" style={{ color: C.muted }}>Ajoutez un relevé Wave, Orange Money ou banque pour détecter les écarts.</div>
          <button onClick={onAjouter} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}><Plus size={15} /> Ajouter un relevé</button>
        </Carte>
      ) : <ResultatRappro r={releveAjoute} />}
    </div>
  );
}
function EnTeteRappro() { return <div><h2 className="text-lg font-semibold">Rapprochement bancaire</h2></div>; }
function ResultatRappro({ r }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Lignes du relevé", r.nbReleve, C.ink], ["Rapprochées", `${pct(r.taux)}`, C.vert], ["Non enregistrés", r.releveOrphelins.length, C.rouge], ["À vérifier", r.comptaOrphelins.length, C.ambre]].map(([l, v, c], i) => (
          <Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      {r.montantNonEnreg > 0 && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle size={18} style={{ color: C.rouge, marginTop: 2 }} />
          <div className="text-sm"><span className="font-semibold" style={{ color: C.rouge }}>{fcfa(r.montantNonEnreg)} présents sur le relevé mais absents de votre comptabilité.</span></div>
        </div>
      )}
      <Carte>
        <div className="border-b px-5 py-3 text-sm font-semibold" style={{ borderColor: C.hairline }}>Encaissements non enregistrés</div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>
          {r.releveOrphelins.map((o, i) => { const cfg = CANAUX[o.canal] || CANAUX["Autre"]; const Ic = cfg.icone; return (
            <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: cfg.c + "18" }}><Ic size={15} style={{ color: cfg.c }} /></div>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{o.libelle}</div><div className="text-[11px]" style={{ color: C.muted }}>{o.canal} · {o.date}</div></div>
              <div className="text-right"><div className="font-semibold tabular-nums">{court(o.montant)}</div><div className="flex items-center justify-end gap-1 text-[11px]" style={{ color: C.rouge }}><XCircle size={11} /> à enregistrer</div></div>
            </div>); })}
        </div>
      </Carte>
    </div>
  );
}

/* ============================================================ PME : FINANCEMENT (+ consentement) ============================================================ */
function Financement({ profil: p, institutions, partages, setPartages, valides }) {
  const sante = p.marge > 0.25 ? { l: "Solide", c: C.vert } : p.marge > 0.1 ? { l: "Correct", c: C.or } : { l: "Fragile", c: C.rouge };
  const histo = genererHistorique(p);
  const ind = [["Taux d'encaissement", p.taux, "part des ventes déjà payées", p.taux > 0.7], ["Marge nette", p.marge, "(ventes − charges) / ventes", p.marge > 0.25], ["Poids des charges fixes", p.poidsFixe, "loyer + salaires / ventes", p.poidsFixe < 0.2]];
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Mon financement</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Votre santé financière telle qu'un financeur la lirait — chaque élément expliqué, rien d'obscur.</p></div>
      <Carte className="flex flex-col items-center p-6 text-center">
        <div className="text-xs font-medium" style={{ color: C.muted }}>Votre situation ce mois-ci</div>
        <div className="mt-1 font-serif text-4xl font-semibold" style={{ color: sante.c }}>{sante.l}</div>
      </Carte>
      <Carte className="p-5">
        <div className="mb-1 text-sm font-semibold">Votre évolution sur 4 mois</div>
        <div className="mb-3 text-[11px]" style={{ color: C.muted }}>Votre santé financière, mois par mois.</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={histo} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs><linearGradient id="gfin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="mois" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} width={28} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v}/100`, "Santé"]} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Area type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2.2} fill="url(#gfin)" />
          </AreaChart>
        </ResponsiveContainer>
      </Carte>
      <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Ce qui compte pour un financeur</div>
        <div className="space-y-3">{ind.map(([l, v, note, bon], i) => (
          <div key={i}><div className="flex items-center justify-between text-sm"><span className="font-medium">{l}</span><span className="text-xs font-semibold" style={{ color: bon ? C.vert : C.ambre }}>{pct(v)}</span></div>
            <div className="mt-1"><Barre valeur={v * 100} couleur={bon ? C.vert : C.ambre} /></div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>{note}</div></div>))}
        </div>
      </Carte>
      <Carte className="p-5">
        <div className="flex items-start gap-3"><Link2 size={18} style={{ color: C.teal, marginTop: 2 }} />
          <div><div className="text-sm font-semibold">Partager mon profil avec mes institutions partenaires</div>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>Choisissez les établissements autorisés à consulter votre profil. Vous restez propriétaire de vos données et pouvez retirer un accès à tout moment.</p></div></div>
        <div className="mt-4 space-y-2">
          {institutions.map((inst) => {
            const on = partages.includes(inst.id); const validee = (valides[inst.id] || []).includes(0);
            return (
              <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.hairline, background: on ? "#F0F5F4" : "#fff" }}>
                <div><div className="text-sm font-medium">{inst.nom}</div>
                  <div className="text-[11px]" style={{ color: validee ? C.vert : C.muted }}>{on ? (validee ? "Profil partagé · dossier validé" : "Profil partagé · en attente de validation") : "Non partagé"}</div></div>
                <button onClick={() => setPartages(on ? partages.filter((x) => x !== inst.id) : [...partages, inst.id])} role="switch" aria-checked={on} className="relative h-6 w-11 shrink-0 rounded-full" style={{ background: on ? C.teal : "#CBD2CC" }}><span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 22 : 2 }} /></button>
              </div>
            );
          })}
        </div>
      </Carte>
    </div>
  );
}

/* ============================================================ INSTITUTION : VIGIE ============================================================ */
function Board({ agg, setVue, onOpen, candidatsCount, instNom }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 sm:p-8" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.rouge }}><ShieldAlert size={18} /> Alerte précoce</div>
            <h1 className="mt-3 font-serif text-2xl font-semibold leading-snug sm:text-3xl">{agg.watchlist.length} emprunteurs à jour, mais en dégradation.</h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>Ils représentent <span className="font-semibold" style={{ color: C.rouge }}>{fcfa(agg.expoAlerte)}</span> d'exposition invisible au PAR. Leurs signaux de trésorerie se détériorent — la fenêtre pour agir avant l'impayé.</p>
            <button onClick={() => setVue("watch")} className="mt-4 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}>Voir la watchlist <ChevronRight size={15} /></button></div>
          <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Exposition sous alerte</div><div className="font-serif text-3xl font-semibold tabular-nums" style={{ color: C.rouge }}>{court(agg.expoAlerte)}</div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>{pct(agg.expoAlerte / agg.encoursTotal)} de l'encours</div></div>
        </div>
      </div>
      {candidatsCount > 0 && (<button onClick={() => setVue("valider")} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-xs" style={{ background: "#FFFBEB", color: C.ambre, border: "1px solid #FDE68A" }}><BadgeCheck size={14} /> {candidatsCount} PME a partagé son profil avec {instNom} et attend votre validation — cliquez pour l'examiner.</button>)}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Encours brut", court(agg.encoursTotal), C.ink], ["PAR 30", pct(agg.par30), C.ambre], ["PAR 90", pct(agg.par90), C.rouge], ["Coût du risque", pct(agg.coutRisque), C.or]].map(([l, v, c], i) => (
          <Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Encours par secteur</div>
          <ResponsiveContainer width="100%" height={210}><BarChart data={agg.parSecteur} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" horizontal={false} /><XAxis type="number" tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="nom" width={78} tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => fcfa(v)} cursor={{ fill: "#F5F6F4" }} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Bar dataKey="encours" radius={[0, 4, 4, 0]} fill={C.teal} /></BarChart></ResponsiveContainer></Carte>
        <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Encours par statut de risque</div>
          <ResponsiveContainer width="100%" height={210}><BarChart data={agg.parStatut} margin={{ left: 4, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="statut" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} /><YAxis tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} width={44} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n, p) => [fcfa(v), `${p.payload.nb} emprunteurs`]} cursor={{ fill: "#F5F6F4" }} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Bar dataKey="encours" radius={[4, 4, 0, 0]}>{agg.parStatut.map((d, i) => <Cell key={i} fill={STATUTS[d.statut].c} />)}</Bar></BarChart></ResponsiveContainer></Carte>
      </div>
      <Carte><div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: C.hairline }}><div className="text-sm font-semibold">Watchlist — priorités</div><button onClick={() => setVue("watch")} className="text-xs font-medium" style={{ color: C.teal }}>Tout voir →</button></div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>{agg.watchlist.slice(0, 4).map((e) => <LigneWL key={e.id} e={e} onOpen={onOpen} />)}</div></Carte>
    </div>
  );
}
function LigneWL({ e, onOpen }) {
  return (
    <button onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-[#FAFBFA]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-serif text-sm font-bold" style={{ background: "#F0F5F4", color: C.teal }}>{e.score}</div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{e.nom}</span>{e.isFocus && <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#F0F5F4", color: C.teal }}><Link2 size={10} /> partagé</span>}</div><div className="text-[11px]" style={{ color: C.muted }}>{e.secteur} · {e.region}</div></div>
      <div className="hidden text-right sm:block"><div className="text-[11px]" style={{ color: C.muted }}>stress</div><div className="text-sm font-semibold" style={{ color: C.rouge }}>J+{e.joursAvantStress}</div></div>
      <div className="hidden sm:block"><Trend delta={e.scoreDelta} /></div>
      <div className="text-right"><div className="font-semibold tabular-nums">{court(e.ead)}</div><div className="text-[11px]" style={{ color: C.muted }}>encours</div></div><ChevronRight size={16} style={{ color: C.muted }} />
    </button>
  );
}
function Watch({ agg, onOpen }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Alerte précoce</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Emprunteurs à jour — invisibles au PAR — dont les signaux de trésorerie se dégradent. Classés par sévérité × exposition.</p></div>
      <div className="grid grid-cols-3 gap-4">{[["Signalés", agg.watchlist.length, C.rouge], ["Exposition", court(agg.expoAlerte), C.ambre], ["Part encours", pct(agg.expoAlerte / agg.encoursTotal), C.or]].map(([l, v, c], i) => (<Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}</div>
      <Carte><div className="divide-y" style={{ borderColor: C.hairline }}>{agg.watchlist.map((e) => <LigneWL key={e.id} e={e} onOpen={onOpen} />)}</div></Carte>
    </div>
  );
}
function Liste({ portefeuille, onOpen }) {
  const [q, setQ] = useState(""); const [tri, setTri] = useState("ead");
  const arr = useMemo(() => { let a = portefeuille.filter((e) => e.nom.toLowerCase().includes(q.toLowerCase()) || e.secteur.toLowerCase().includes(q.toLowerCase())); return [...a].sort((x, y) => tri === "ead" ? y.ead - x.ead : tri === "score" ? x.score - y.score : y.dpd - x.dpd); }, [portefeuille, q, tri]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Portefeuille — {portefeuille.length} emprunteurs</h2>
        <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5" style={{ borderColor: C.hairline }}><Search size={14} style={{ color: C.muted }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="w-32 bg-transparent text-sm outline-none sm:w-44" /></div>
          <select value={tri} onChange={(e) => setTri(e.target.value)} className="rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none" style={{ borderColor: C.hairline }}><option value="ead">Encours ↓</option><option value="score">Score ↑</option><option value="dpd">Retard ↓</option></select></div></div>
      <Carte>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-5 py-2.5 text-[11px] font-semibold sm:grid-cols-[1fr_auto_auto_auto_auto]" style={{ borderColor: C.hairline, color: C.muted }}><div>Emprunteur</div><div className="hidden text-right sm:block">Statut</div><div className="hidden text-right sm:block">Retard</div><div className="text-right">Score</div><div className="text-right">Encours</div></div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>{arr.map((e) => (
          <button key={e.id} onClick={() => onOpen(e.id)} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 text-left text-sm hover:bg-[#FAFBFA] sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="flex min-w-0 items-center gap-2">{e.alertePrecoce && <ShieldAlert size={14} style={{ color: C.rouge }} />}<div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-medium">{e.nom}</span>{e.isFocus && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#ECFDF5", color: C.vert }}><BadgeCheck size={10} /> validé</span>}</div><div className="text-[11px]" style={{ color: C.muted }}>{e.secteur} · {e.region}</div></div></div>
            <div className="hidden justify-end sm:flex"><StatutChip statut={e.statut} petit /></div>
            <div className="hidden text-right text-xs sm:block" style={{ color: e.dpd > 0 ? C.rouge : C.muted }}>{e.dpd > 0 ? `${e.dpd} j` : "—"}</div>
            <div className="text-right font-serif text-base font-semibold">{e.score}</div><div className="text-right font-semibold tabular-nums">{court(e.ead)}</div>
          </button>))}
        </div>
      </Carte>
    </div>
  );
}
function AValider({ candidats, onOpen, onValider, onEcarter, instNom }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">PME à valider</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Les PME qui ont partagé leur profil avec {instNom} et attendent votre décision. Évaluez le score et sa trajectoire, puis validez pour les intégrer à votre portefeuille, ou écartez.</p></div>
      {candidats.length === 0 ? (
        <Vide icone={BadgeCheck} titre="Aucune candidature en attente" texte="Lorsqu'une PME partagera son profil avec votre établissement, elle apparaîtra ici pour validation." />
      ) : candidats.map((e) => (
        <Carte key={e.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="text-base font-semibold">{e.nom}</div><div className="mt-0.5 text-xs" style={{ color: C.muted }}>{e.secteur} · {e.region} · encours proposé {court(e.ead)}</div></div>
            <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Score</div><div className="flex items-baseline justify-end gap-1"><span className="font-serif text-2xl font-semibold tabular-nums">{e.score}</span><Trend delta={e.scoreDelta} /></div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => onOpen(e.id)} className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: C.teal }}>Voir le dossier complet <ChevronRight size={15} /></button>
            <div className="flex gap-2">
              <button onClick={() => onEcarter(e.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: C.hairline, color: C.muted }}><Ban size={14} /> Écarter</button>
              <button onClick={() => onValider(e.id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.vert }}><BadgeCheck size={15} /> Valider</button>
            </div>
          </div>
        </Carte>
      ))}
    </div>
  );
}
function Fiche({ e, partageActive, estCandidat, onValider, onEcarter, onBack }) {
  const f = useMemo(() => ficheData(e), [e]);
  const partage = e.isFocus ? partageActive : true;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: C.teal }}><ArrowLeft size={15} /> Retour au portefeuille</button>
      <Carte className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{e.nom}</h2><StatutChip statut={e.statut} />{e.alertePrecoce && partage && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#FEF2F2", color: C.rouge, border: "1px solid #FECACA" }}><ShieldAlert size={11} /> Alerte précoce</span>}</div>
            <div className="mt-1 text-sm" style={{ color: C.muted }}>{e.secteur} · {e.region} · client depuis {e.anciennete} mois · taux {pct(e.taux, 1)}</div></div>
          <div className="flex flex-wrap gap-6">
            <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Encours (EAD)</div><div className="font-serif text-2xl font-semibold tabular-nums">{court(e.ead)}</div></div>
            {partage && <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Score</div><div className="flex items-baseline justify-end gap-1"><span className="font-serif text-2xl font-semibold tabular-nums">{e.score}</span><Trend delta={e.scoreDelta} /></div></div>}
            {partage && <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Perte attendue</div><div className="font-serif text-2xl font-semibold tabular-nums" style={{ color: C.ambre }}>{court(e.ecl)}</div><div className="text-[10px]" style={{ color: C.muted }}>PD {pct(e.pd)} · LGD {pct(e.lgd)}</div></div>}
          </div>
        </div>
        {e.isFocus && <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: partage ? "#F0F5F4" : "#FFFBEB", color: partage ? C.teal : C.ambre, border: `1px solid ${partage ? C.hairline : "#FDE68A"}` }}><Link2 size={13} /> {partage ? "Profil partagé par l'emprunteur." : "Profil non partagé — accès limité à l'encours."}</div>}
      </Carte>
      {estCandidat && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <div className="text-sm"><span className="font-semibold" style={{ color: C.ambre }}>Dossier en attente de décision.</span> <span style={{ color: C.muted }}>Évaluez le score et sa trajectoire, puis tranchez.</span></div>
          <div className="flex gap-2">
            <button onClick={onEcarter} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: C.hairline, color: C.muted }}><Ban size={14} /> Écarter</button>
            <button onClick={onValider} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.vert }}><BadgeCheck size={15} /> Valider ce dossier</button>
          </div>
        </div>
      )}
      {partage ? (<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte className="p-5"><div className="mb-1 text-sm font-semibold">{f.histo ? "Évolution du score (4 mois)" : "Trésorerie"}</div>
          {f.histo ? (
            <div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={f.histo} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs><linearGradient id="ghi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="mois" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} width={28} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v}/100`, "Score"]} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Area type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2} fill="url(#ghi)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[11px]" style={{ color: C.muted }}><span>Encaissé {court(f.bridge.encaisse)}</span><span>À recevoir {court(f.bridge.creances)}</span><span>Position {court(f.bridge.projete)}</span></div>
            </div>
          ) : (
            <><div className="mb-3 text-[11px]" style={{ color: C.muted }}>{f.rupture ? `Rupture projetée le ${f.rupture.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}` : "Pas de rupture projetée"}</div>
              <ResponsiveContainer width="100%" height={200}><AreaChart data={f.serie} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={f.rupture ? C.rouge : C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={f.rupture ? C.rouge : C.teal} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: C.muted }} interval={11} axisLine={false} tickLine={false} /><YAxis tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} width={44} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fcfa(v)} labelFormatter={() => ""} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><ReferenceLine y={0} stroke={C.rouge} strokeDasharray="4 3" /><Area type="monotone" dataKey="solde" stroke={f.rupture ? C.rouge : C.teal} strokeWidth={2} fill="url(#gf)" /></AreaChart></ResponsiveContainer></>
          )}
        </Carte>
        <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Décomposition du score</div>
          <div className="space-y-3">{f.signaux.map((s) => (<div key={s.nom}><div className="flex items-baseline justify-between text-sm"><span className="font-medium">{s.nom}</span><span className="tabular-nums" style={{ color: C.muted }}><span className="font-semibold" style={{ color: C.ink }}>{s.score}</span>/100 <span className="text-[10px]">· {pct(s.poids)}</span></span></div><div className="mt-1"><Barre valeur={s.score} couleur={s.score >= 65 ? C.vert : s.score >= 45 ? C.or : C.rouge} /></div></div>))}</div>
        </Carte>
      </div>) : (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: C.muted }}>Profil non partagé — aucun signal disponible.</div>
      )}
    </div>
  );
}
function ficheData(e) {
  const noms = [["Jours de trésorerie", 0.22], ["Régularité des encaissements", 0.20], ["Tendance du CA", 0.15], ["Poids des charges fixes", 0.15], ["Stabilité du solde", 0.14], ["Discipline de trésorerie", 0.14]];
  if (e.isFocus && e.profil) {
    const p = e.profil;
    const signaux = noms.map(([nom, poids]) => ({ nom, poids, score: Math.max(8, Math.min(96, e.score + Math.round((noms.findIndex((n) => n[0] === nom) - 2.5) * 3))) }));
    return { bridge: { encaisse: p.encaisse, creances: p.creances, decaisse: p.decaisse, projete: p.projete }, histo: e.histo, signaux };
  }
  const r = rng(1000 + e.id); const serie = []; let solde = e.ead * (0.12 + r() * 0.1); const net = e.score > 60 ? 1 : e.score > 50 ? 0.4 : -0.5;
  for (let d = 0; d <= 60; d++) { const date = new Date(2026, 10, 15 + d); const choc = (d === 22 || d === 44) ? -e.ead * 0.11 : 0; solde += net * (e.ead * 0.004) * (0.6 + r() * 0.8) + choc; serie.push({ d, date, dateLabel: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), solde }); }
  const rupture = serie.find((p) => p.d > 0 && p.solde < 0);
  const signaux = noms.map(([nom, poids]) => ({ nom, poids, score: Math.max(5, Math.min(98, e.score + Math.round((r() - 0.5) * 34))) }));
  return { serie, rupture, signaux };
}
