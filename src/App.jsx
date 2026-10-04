import React, { useState, useMemo, useCallback, useEffect, createContext, useContext } from "react";
import { lireClasseur, rolesAuto, autoMap, CHAMPS_ROLE, manquants, extraireFeuille, analyserMois, diagnostiquer, libelleMois, finDuMois, nomDepuisFichier, parseMontant, SEUIL_ALERTE, CHUTE_ALERTE, CHUTE_PIC, situerDansLeTemps, decalerDates, debutJour, ajouterJoursA, ecartJours, relatif, SEUILS_FRAICHEUR } from "./analyse.js";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Line,
} from "recharts";
import {
  UploadCloud, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  AlertTriangle, Wallet, TrendingUp, TrendingDown, Link2, Info, Table2, ShieldCheck,
  RefreshCw, ChevronRight, Landmark, Store, Smartphone, Banknote, CircleDollarSign,
  ShieldAlert, Layers, Building2, Search, Sparkles, HeartPulse, GitCompareArrows, Plus, BadgeCheck, Ban, Coins,
  Bell, Send, MessageSquare, CalendarClock, ClipboardList, RotateCcw, CheckCheck, Lightbulb, ChevronDown, X, Activity, Download, CalendarDays,
} from "lucide-react";

/* ============================================================
   PLATEFORME DE CRÉDIT — MVP fusionné (modèle 2)
   Une seule application :
     • Espace PME : Import → Trésorerie → Rapprochement → Financement
     • Espace Institution (VIGIE) : risque de portefeuille
   • Analyse mois par mois de n'importe quel fichier (src/analyse.js) :
     dégradation des signaux jusqu'à l'alerte précoce
   • Recommandations : l'institution transforme l'alerte précoce en
     conseils envoyés à la PME, qui répond depuis son espace
   Le profil issu de l'import alimente VIGIE (consentement).
   Rapprochement : affiché depuis le fichier s'il est présent ;
   sinon, ajout optionnel d'un relevé qui active la détection d'écarts.
   Données réelles (NPM Multiservices) intégrées. Montants en FCFA,
   affichables dans d'autres devises (taux indicatifs, voir DEVISES).
   ============================================================ */

/* ---------- utilitaires ---------- */
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const abreger = (n) => { const a = Math.abs(n), s = n < 0 ? "-" : ""; if (a >= 1e9) return s + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",") + " Md"; if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " M"; if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(".", ",") + " k"; return s + Math.round(a); };
const pct = (x, d = 0) => (x * 100).toFixed(d).replace(".", ",") + " %";

/* ---------- devises d'affichage ----------
   Les données restent en FCFA ; seul l'affichage est converti.
   xof = valeur en FCFA d'une unité de la devise. Taux indicatifs relevés le
   03/10/2026 (moyenne open.er-api.com et currency-api) ; EUR et CVE : parités fixes.
   À actualiser ici si besoin. */
const TAUX_DATE = "3 octobre 2026";
const DEVISES = {
  XOF: { nom: "Franc CFA", sym: "FCFA", xof: 1 },
  EUR: { nom: "Euro", sym: "€", xof: 655.957, fixe: true },
  USD: { nom: "Dollar américain", sym: "$US", xof: 583.0 },
  GBP: { nom: "Livre sterling", sym: "£", xof: 770.55 },
  CHF: { nom: "Franc suisse", sym: "CHF", xof: 703.11 },
  CAD: { nom: "Dollar canadien", sym: "$CA", xof: 409.7 },
  CNY: { nom: "Yuan chinois", sym: "CNY", xof: 86.83 },
  GNF: { nom: "Franc guinéen", sym: "GNF", xof: 0.06615 },
  GMD: { nom: "Dalasi gambien", sym: "GMD", xof: 7.842 },
  MRU: { nom: "Ouguiya mauritanien", sym: "MRU", xof: 14.511 },
  CVE: { nom: "Escudo cap-verdien", sym: "CVE", xof: 5.9489, fixe: true },
  NGN: { nom: "Naira nigérian", sym: "₦", xof: 0.437 },
  GHS: { nom: "Cedi ghanéen", sym: "GH₵", xof: 49.557 },
  MAD: { nom: "Dirham marocain", sym: "MAD", xof: 59.144 },
  ZAR: { nom: "Rand sud-africain", sym: "ZAR", xof: 34.969 },
  KES: { nom: "Shilling kényan", sym: "KES", xof: 4.49 },
};
const GROUPES_DEVISES = [["Principales", ["XOF", "EUR", "USD", "GBP", "CHF", "CAD", "CNY"]], ["Afrique", ["GNF", "GMD", "MRU", "CVE", "NGN", "GHS", "MAD", "ZAR", "KES"]]];
const nombre = (n, dec) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
// montant : valeur complète (« 4 063 500 FCFA », « 6 194,72 € ») ; court : valeur abrégée (« 9,8 M », « 15 k € »)
function formateurs(code) {
  const d = DEVISES[code]; const dec = d.xof >= 40 ? 2 : 0; const unite = code === "XOF" ? "" : " " + d.sym;
  return { montant: (n) => nombre(n / d.xof, dec) + " " + d.sym, court: (n) => abreger(n / d.xof) + unite };
}
function texteTaux(code) {
  const d = DEVISES[code]; const fmt = (x) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(x);
  return d.xof >= 1 ? `1 ${d.sym} = ${fmt(d.xof)} FCFA` : `1 FCFA = ${fmt(1 / d.xof)} ${d.sym}`;
}
const DeviseContext = createContext(formateurs("XOF"));
const useMontants = () => useContext(DeviseContext);
// date et heure réelles, rafraîchies en continu : alertes, prévisions et contrôles sont situés par rapport à elles
const AujourdhuiContext = createContext({ maintenant: new Date(), aujourdhui: debutJour(new Date()) });
const useAujourdhui = () => useContext(AujourdhuiContext);
const premier = (t) => t.replace(/^1 /, "1er "); // « 1er septembre »
const dateLongueAn = (d) => premier(d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
const dateCourte = (d) => d.toLocaleDateString("fr-FR", d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "2-digit" });
const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const C = { ink: "#0E1B2C", canvas: "#F5F6F4", vert: "#047857", teal: "#0F766E", ambre: "#B45309", or: "#A16207", rouge: "#B91C1C", rougeF: "#7F1D1D", muted: "#5B6472", hairline: "#E3E6E2" };
const STATUTS = { Sain: { c: C.vert, bg: "#ECFDF5", bd: "#A7F3D0" }, Arriérés: { c: C.or, bg: "#FEFCE8", bd: "#FDE68A" }, PAR30: { c: C.ambre, bg: "#FFFBEB", bd: "#FDE68A" }, PAR90: { c: C.rouge, bg: "#FEF2F2", bd: "#FECACA" }, Douteux: { c: C.rougeF, bg: "#FEF2F2", bd: "#FCA5A5" } };
const CANAUX = { "Virement": { c: "#0E1B2C", icone: Landmark }, "Espèces": { c: C.or, icone: Banknote }, "Orange Money": { c: "#F16E00", icone: Smartphone }, "Wave": { c: "#1DC8FF", icone: Smartphone }, "Prélèvement": { c: C.teal, icone: RefreshCw }, "Autre": { c: C.muted, icone: CircleDollarSign } };
const INSTITUTIONS = [{ id: "cayor", nom: "Cayor Crédit", conseiller: "Fatou Sarr" }, { id: "jappoo", nom: "Jappoo Microfinance", conseiller: "Ibrahima Ba" }, { id: "ndiambour", nom: "Ndiambour Capital", conseiller: "Mariama Cissé" }];
const SEEDS = { cayor: 20261121, jappoo: 55012, ndiambour: 88133 };

/* ---------- données réelles (jeu d'exemple) ---------- */
const EX_VENTES = [
  { Date: "2026-06-02", Client: "Alimentation Ndiaye & Frères", Produit: "Sac de riz parfumé 50 kg", Montant: 2790000, Mode: "Virement", Statut: "Payé", Clé: 46175.0001 },
  { Date: "2026-06-03", Client: "Restaurant Keur Ndèye", Produit: "Bidon d'huile végétale 20 L", Montant: 850000, Mode: "Espèces", Statut: "Payé", Clé: 46176.00011 },
  { Date: "2026-06-05", Client: "Boutique Aïssatou Sow", Produit: "Sac de ciment 50 kg", Montant: 1840000, Mode: "Orange Money", Statut: "Payé", Clé: 46178.00012 },
  { Date: "2026-06-07", Client: "Ets Moussa Diop", Produit: "Sac de riz parfumé 50 kg", Montant: 1860000, Mode: "Virement", Statut: "Impayé", Clé: 46180.00013 },
  { Date: "2026-06-09", Client: "Sté Mbaye Distribution", Produit: "Carton de savon (48 pcs)", Montant: 780000, Mode: "Wave", Statut: "Payé", Clé: 46182.00014 },
  { Date: "2026-06-11", Client: "Ets Ousmane Faye", Produit: "Prestation transport & livraison", Montant: 125000, Mode: "Espèces", Statut: "Payé", Clé: 46184.00015 },
  { Date: "2026-06-12", Client: "Alimentation Ndiaye & Frères", Produit: "Bidon d'huile végétale 20 L", Montant: 1020000, Mode: "Orange Money", Statut: "Payé", Clé: 46185.00016 },
  { Date: "2026-06-14", Client: "Marché Sandaga — F. Guèye", Produit: "Sac de ciment 50 kg", Montant: 1380000, Mode: "Virement", Statut: "Impayé", Clé: 46187.00017 },
  { Date: "2026-06-16", Client: "Restaurant Keur Ndèye", Produit: "Contrat maintenance mensuel", Montant: 90000, Mode: "Virement", Statut: "Payé", Clé: 46189.00018 },
  { Date: "2026-06-18", Client: "Ets Moussa Diop", Produit: "Carton de savon (48 pcs)", Montant: 546000, Mode: "Espèces", Statut: "Payé", Clé: 46191.00019 },
  { Date: "2026-06-20", Client: "Boutique Aïssatou Sow", Produit: "Sac de riz parfumé 50 kg", Montant: 1162500, Mode: "Orange Money", Statut: "Payé", Clé: 46193.0002 },
  { Date: "2026-06-22", Client: "Ets Ousmane Faye", Produit: "Prestation transport & livraison", Montant: 125000, Mode: "Wave", Statut: "Payé", Clé: 46195.00021 },
  { Date: "2026-06-24", Client: "Sté Mbaye Distribution", Produit: "Bidon d'huile végétale 20 L", Montant: 680000, Mode: "Virement", Statut: "Impayé", Clé: 46197.00022 },
  { Date: "2026-06-27", Client: "Alimentation Ndiaye & Frères", Produit: "Sac de ciment 50 kg", Montant: 2760000, Mode: "Virement", Statut: "Payé", Clé: 46200.00023 },
];
const EX_DEPENSES = [
  { Date: "2026-06-01", Fournisseur: "Rizerie du Walo", Libellé: "Approvisionnement riz", Montant: 2200000, Mode: "Virement", Statut: "Payé", Clé: 46174.0001 },
  { Date: "2026-06-04", Fournisseur: "Huilerie du Saloum", Libellé: "Stock huile végétale", Montant: 1440000, Mode: "Virement", Statut: "Payé", Clé: 46177.00011 },
  { Date: "2026-06-06", Fournisseur: "Ciments de la Petite-Côte", Libellé: "Stock ciment", Montant: 1520000, Mode: "Virement", Statut: "Impayé", Clé: 46179.00012 },
  { Date: "2026-06-10", Fournisseur: "Grossiste Thiam & Fils", Libellé: "Stock savon", Montant: 980000, Mode: "Espèces", Statut: "Payé", Clé: 46183.00013 },
  { Date: "2026-06-05", Fournisseur: "Senelec / SEN'EAU", Libellé: "Électricité Senelec", Montant: 320000, Mode: "Virement", Statut: "Payé", Clé: 46178.00014 },
  { Date: "2026-06-05", Fournisseur: "Senelec / SEN'EAU", Libellé: "Eau SEN'EAU", Montant: 85000, Mode: "Virement", Statut: "Payé", Clé: 46178.00015 },
  { Date: "2026-06-03", Fournisseur: "Bailleur", Libellé: "Loyer magasin", Montant: 600000, Mode: "Virement", Statut: "Payé", Clé: 46176.00016 },
  { Date: "2026-06-15", Fournisseur: "Orange Sénégal", Libellé: "Télécom & Internet", Montant: 140000, Mode: "Orange Money", Statut: "Payé", Clé: 46188.00017 },
  { Date: "2026-06-28", Fournisseur: null, Libellé: "Salaires du personnel", Montant: 1200000, Mode: "Virement", Statut: "Payé", Clé: 46201.00018 },
  { Date: "2026-06-12", Fournisseur: "Transports Seck", Libellé: "Carburant & livraisons", Montant: 480000, Mode: "Espèces", Statut: "Payé", Clé: 46185.00019 },
  { Date: "2026-06-20", Fournisseur: "Transports Seck", Libellé: "Location camion", Montant: 220000, Mode: "Espèces", Statut: "Payé", Clé: 46193.0002 },
  { Date: "2026-06-18", Fournisseur: null, Libellé: "Fournitures de bureau", Montant: 150000, Mode: "Espèces", Statut: "Payé", Clé: 46191.00021 },
  { Date: "2026-06-25", Fournisseur: null, Libellé: "Frais bancaires & taxes", Montant: 210000, Mode: "Prélèvement", Statut: "Payé", Clé: 46198.00022 },
];
// rapprochement présent dans le fichier réel
const EX_RECON = {
  comptes: [
    { compte: "Banque (521)", canal: "Virement", comptable: 4585000, releve: 4615000 },
    { compte: "Orange Money (5211)", canal: "Orange Money", comptable: 4382500, releve: 4367500 },
  ],
  lettrage: [
    { date: "2026-06-07", tiers: "Ets Moussa Diop", piece: "VT-004 ↔ RG-014", montant: 1860000, statut: "Lettré", ecart: 0 },
    { date: "2026-06-14", tiers: "Marché Sandaga", piece: "VT-008", montant: 1380000, statut: "Non lettré", ecart: 1380000 },
    { date: "2026-06-06", tiers: "Ciments de la Petite-Côte", piece: "AC-003", montant: 1520000, statut: "Non lettré", ecart: -1520000 },
  ],
};

/* ---------- lecture, extraction, profil et analyse mensuelle : voir src/analyse.js ---------- */

/* ---------- rapprochement Branch B : relevé ajouté ---------- */
function genererReleveExemple(E, cle) {
  // relevé bancaire/mobile d'exemple, dérivé des ventes encaissées (hors espèces) + anomalies réalistes
  const bancaires = E.filter((e) => e.statut === "Payé" && e.canal !== "Espèces");
  const releve = [];
  bancaires.forEach((e, i) => {
    if (i === 3) return;                          // omission : encaissement présent en compta mais absent du relevé → à vérifier
    const frais = e.canal.includes("Money") ? Math.round(e.montant * 0.01) : 0;
    releve.push({ date: e.date, montant: e.montant - frais, canal: e.canal, libelle: e.tiers, frais });
  });
  // 2 crédits présents au relevé mais jamais comptabilisés (revenus non enregistrés)
  releve.push({ date: `${cle}-08`, montant: 420000, canal: "Orange Money", libelle: "Encaissement non identifié", frais: 0 });
  releve.push({ date: `${cle}-19`, montant: 265000, canal: "Virement", libelle: "Virement reçu non rapproché", frais: 0 });
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
const REG = ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Kaolack", "Touba", "Mbour"];
const PRE = ["Ets", "Sarl", "Groupe", "GIE", "Ste"];
const ROOT = ["Teranga", "Jàmm", "Ndakaaru", "Bamtaare", "Diarama", "Liggéey", "Naatangué", "Lompoul", "Baol", "Saloum", "Walo", "Djolof", "Casamance", "Gorée", "Thiossane", "Kaay", "Ndeyssane", "Sunu", "Dalal", "Niokolo"];
const ACT = ["Négoce", "Trading", "Logistique", "Agro", "Services", "Distribution", "Commerce", "Bâtiment", "Import", "Transit"];
function genererPortefeuille(seed) {
  const r = rng(seed); const arr = [];
  for (let i = 1; i < 48; i++) {
    const nom = `${PRE[Math.floor(r() * PRE.length)]} ${ROOT[Math.floor(r() * ROOT.length)]} ${ACT[Math.floor(r() * ACT.length)]}`;
    const secteur = SECT[Math.floor(r() * SECT.length)], region = REG[Math.floor(r() * REG.length)];
    const ead = Math.round((2 + Math.pow(r(), 2.3) * 118) * 1e5 / 5e4) * 5e4, taux = 0.09 + r() * 0.09, anciennete = 2 + Math.floor(r() * 46);
    let score = Math.round(38 + r() * 52); const chute = r() < 0.36; const scoreDelta = chute ? -(11 + Math.round(r() * 17)) : Math.round(-4 + r() * 9);
    const risk = (100 - score) / 100, u = r(); let dpd = 0;
    if (u < risk * 0.75) { const sv = r(); if (sv < 0.22) dpd = 121 + Math.floor(r() * 160); else if (sv < 0.55) dpd = 31 + Math.floor(r() * 90); else dpd = 1 + Math.floor(r() * 30); }
    let statut = "Sain"; if (dpd > 180) statut = "Douteux"; else if (dpd > 90) statut = "PAR90"; else if (dpd > 30) statut = "PAR30"; else if (dpd > 0) statut = "Arriérés";
    const ap = dpd === 0 && scoreDelta <= -11 && score < 66; const js = ap ? Math.max(12, Math.round(60 + scoreDelta * 2 + (score - 45))) : null;
    const pd = Math.max(0.02, Math.min(0.6, 0.02 + risk * 0.42 + (dpd > 30 ? 0.15 : 0)));
    arr.push({ id: i, nom, secteur, region, ead, taux, anciennete, score, scoreDelta, dpd, statut, alertePrecoce: ap, joursAvantStress: js, alerteAge: ap ? 1 + Math.floor(rng(7000 + i)() * 20) : null, pd, lgd: 0.45, ecl: ead * pd * 0.45 });
  }
  return arr;
}
// la PME importée, construite en emprunteur-vedette à partir de l'analyse mensuelle de son fichier
function construireVedette({ mois, diag }, nomFocus, releve, temps) {
  const der = diag.dernier, sc = der.score;
  const pd = Math.max(0.02, Math.min(0.6, 0.02 + (100 - sc) / 100 * 0.42));
  const alerte = der.etat === "Alerte précoce";
  return { id: 0, isFocus: true, nom: nomFocus, secteur: "Commerce & distribution", region: "Dakar", ead: 2800000, taux: 0.14, anciennete: 19, score: sc, scoreDelta: der.delta ?? 0, dpd: 0, statut: "Sain", alertePrecoce: alerte, joursAvantStress: alerte ? temps.joursAvantTension : null, dateTension: temps.dateTension, alerteDepuis: alerte ? temps.debutEtat : null, donneesDu: temps.dateDonnees, joursDepuisDonnees: temps.joursDepuis, pd, lgd: 0.45, ecl: 2800000 * pd * 0.45, profil: der.profil, signaux: der.signaux, histo: mois.map((m) => ({ mois: libelleMois(m.cle), score: m.score })), rappro: releve ? { nonEnregistre: releve.montantNonEnreg, nb: releve.releveOrphelins.length } : null };
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
  const [instActive, setInstActive] = useState("cayor");
  const [partages, setPartages] = useState(["cayor", "ndiambour"]);
  const [valides, setValides] = useState({});
  const [rejetes, setRejetes] = useState({});
  const [source, setSource] = useState(null);
  const [roles, setRoles] = useState({}); // rôle de chaque feuille : ventes, dépenses, journal ou ignorer
  const [maps, setMaps] = useState({}); // correspondance des colonnes, par feuille
  const [soldeSaisi, setSoldeSaisi] = useState(null); // trésorerie de départ saisie (sinon : détectée ou zéro)
  const [erreurImport, setErreurImport] = useState(null);
  const [impEtape, setImpEtape] = useState(0);
  const [releveAjoute, setReleveAjoute] = useState(null);
  const [devise, setDevise] = useState("XOF");
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => { // horloge en temps réel (et resynchronisation au retour sur l'onglet)
    const maj = () => setMaintenant(new Date());
    const t = setInterval(maj, 30000);
    window.addEventListener("focus", maj);
    return () => { clearInterval(t); window.removeEventListener("focus", maj); };
  }, []);
  const jour = maintenant.toDateString();
  const aujourdhui = useMemo(() => debutJour(maintenant), [jour]); // eslint-disable-line react-hooks/exhaustive-deps
  const horloge = useMemo(() => ({ maintenant, aujourdhui }), [maintenant, aujourdhui]);
  const formats = useMemo(() => formateurs(devise), [devise]);
  const [notifs, setNotifs] = useState([]); // recommandations envoyées, la plus récente en premier
  const [modeles, setModeles] = useState({}); // modèles modifiés, par institution

  const chargerSource = useCallback((src, solde = null) => {
    const r = rolesAuto(src.feuilles);
    setSource(src); setRoles(r); setMaps(Object.fromEntries(src.feuilles.map((f) => [f.nom, autoMap(f.colonnes, r[f.nom])])));
    setSoldeSaisi(solde); setErreurImport(null); setReleveAjoute(null); setImpEtape(1);
  }, []);
  const chargerExemple = useCallback((avecRapprochement) => {
    const feuille = (nom, lignes) => ({ nom, colonnes: Object.keys(lignes[0]), lignes: lignes.map((l, i) => ({ ...l, __ligne: i + 2 })) });
    chargerSource({ fichier: avecRapprochement ? "NPM Multiservices — fichier complet" : "NPM Multiservices — export sans rapprochement", entreprise: "NPM Multiservices", feuilles: [feuille("Ventes", EX_VENTES), feuille("Dépenses", EX_DEPENSES)], recon: avecRapprochement ? EX_RECON : null });
  }, [chargerSource]);
  const chargerFichier = useCallback(async (file, options = {}) => {
    try {
      const lu = lireClasseur(await file.arrayBuffer(), file.name);
      const feuilles = decalerDates(lu.feuilles, options.decalerMois || 0), nomsFeuilles = lu.nomsFeuilles;
      if (!feuilles.length) { setErreurImport(`Aucune feuille exploitable dans « ${file.name} » : VIGIE cherche une ligne d'en-tête contenant une colonne de date (Date, Jour, Date opération…).`); return; }
      const aRappro = nomsFeuilles.some((n) => /rappro|relev|lettr/i.test(n));
      chargerSource({ fichier: options.decalerMois ? `${file.name} (dates recalées sur les 6 derniers mois)` : file.name, entreprise: options.entreprise || nomDepuisFichier(file.name), feuilles, recon: aRappro ? { comptes: [], lettrage: [], detecteSansDetail: true } : null }, options.soldeInitial ?? null);
    } catch (e) { setErreurImport(`Lecture impossible de « ${file.name} » : fichier protégé, endommagé ou d'un format non pris en charge.`); }
  }, [chargerSource]);
  const chargerExempleMensuel = useCallback(async () => {
    const ex = EXEMPLES_FICHIERS[0];
    try {
      const rep = await fetch(ex.url); if (!rep.ok) throw new Error(rep.statusText);
      const d = new Date(), decalerMois = d.getFullYear() * 12 + d.getMonth() - 1 - (2026 * 12 + 5); // le fichier s'arrête en juin 2026 : on le fait finir le mois dernier
      await chargerFichier(new File([await rep.blob()], ex.fichier), { entreprise: "Quincaillerie Ndar", soldeInitial: 4500000, decalerMois });
    } catch (e) { setErreurImport("Impossible de charger le fichier d'exemple : vérifiez la connexion."); }
  }, [chargerFichier]);

  // lecture de toutes les feuilles retenues, puis analyse mois par mois
  const resultat = useMemo(() => {
    if (!source) return null;
    const actives = source.feuilles.filter((f) => roles[f.nom] && roles[f.nom] !== "ignorer" && maps[f.nom] && !manquants(roles[f.nom], maps[f.nom]).length);
    const lus = actives.map((f) => ({ f, ...extraireFeuille(f, roles[f.nom], maps[f.nom]) }));
    const ops = lus.flatMap((x) => x.valides);
    const debut = (x) => x.valides.reduce((m, o) => (o.date < m ? o.date : m), "9999");
    const premiere = lus.filter((x) => x.valides.length).sort((a, b) => debut(a).localeCompare(debut(b)))[0];
    const soldeDetecte = premiere?.soldeOuverture ?? null; // report à nouveau de la feuille la plus ancienne
    const solde = soldeSaisi ?? soldeDetecte ?? 0;
    const entrees = ops.filter((o) => o.sens === "ENTREE"), sorties = ops.filter((o) => o.sens === "SORTIE");
    const mois = analyserMois(entrees, sorties, solde);
    const diag = diagnostiquer(mois);
    return { entrees, sorties, rejets: lus.flatMap((x) => x.rejets), nbLignes: actives.reduce((a, f) => a + f.lignes.length, 0), nbValides: ops.length, mois, diag, profil: diag ? diag.dernier.profil : null, moisCourant: diag ? diag.dernier.cle : null, soldeDetecte, soldeSaisi, solde };
  }, [source, roles, maps, soldeSaisi]);

  const hasReleve = !!source?.recon;
  const profil = resultat?.profil || null;
  const nomFocus = source ? source.entreprise.trim() || "Ma PME" : "";
  const instNom = INSTITUTIONS.find((i) => i.id === instActive).nom;
  const temps = useMemo(() => (resultat?.diag ? situerDansLeTemps(resultat.mois, resultat.diag, aujourdhui) : null), [resultat, aujourdhui]);
  const vedette = useMemo(() => (resultat?.diag ? construireVedette(resultat, nomFocus, releveAjoute, temps) : null), [resultat, nomFocus, releveAjoute, temps]);
  // portefeuille simulé : alertes et tensions datées à partir d'aujourd'hui
  const book = useMemo(() => genererPortefeuille(SEEDS[instActive]).map((e) => ({ ...e, alerteDepuis: e.alerteAge ? ajouterJoursA(aujourdhui, -e.alerteAge) : null, dateTension: e.joursAvantStress != null ? ajouterJoursA(aujourdhui, e.joursAvantStress) : null })), [instActive, aujourdhui]);
  const partageActive = !!vedette && partages.includes(instActive);
  const vedetteValidee = (valides[instActive] || []).includes(0);
  const estEcarte = (rejetes[instActive] || []).includes(0);
  const candidats = partageActive && !vedetteValidee && !estEcarte ? [vedette] : [];
  const portefeuille = useMemo(() => (partageActive && vedetteValidee ? [vedette, ...book] : book), [partageActive, vedetteValidee, vedette, book]);
  const agg = useMemo(() => agreger(portefeuille), [portefeuille]);
  const selE = sel != null ? (vedette && vedette.id === sel ? vedette : book.find((e) => e.id === sel)) : null;
  const validerPME = (id) => setValides((v) => ({ ...v, [instActive]: [...(v[instActive] || []), id] }));
  const ecarterPME = (id) => setRejetes((v) => ({ ...v, [instActive]: [...(v[instActive] || []), id] }));

  const importe = impEtape >= 3 && !!profil;
  const ajouterReleve = () => { const E = resultat.entrees.filter((e) => e.date.startsWith(resultat.moisCourant)); setReleveAjoute(rapprocher(E, genererReleveExemple(E, resultat.moisCourant))); };

  // recommandations : envoi par l'institution, lecture et réponse par la PME
  const inst = INSTITUTIONS.find((i) => i.id === instActive);
  const modelesInst = useMemo(() => ({ ...MODELES_DEFAUT, ...(modeles[instActive] || {}) }), [modeles, instActive]);
  const notifsInst = useMemo(() => notifs.filter((n) => n.inst === instActive), [notifs, instActive]);
  const notifsPME = useMemo(() => notifs.filter((n) => n.empId === 0), [notifs]);
  const notifsParEmp = useMemo(() => { const m = {}; notifsInst.forEach((n) => { if (!m[n.empId]) m[n.empId] = n; }); return m; }, [notifsInst]);
  const nonLues = notifsPME.filter((n) => n.statut === "Envoyée").length;
  const reponsesAttente = notifsInst.filter((n) => n.statut === "Réponse reçue").length;
  const majNotif = (id, f) => setNotifs((ns) => ns.map((n) => (n.id === id ? f(n) : n)));
  const etape = (n, statut, par) => ({ ...n, statut, historique: [...n.historique, { statut, le: new Date(), par }] });
  const envoyerNotif = (e, c) => { const le = new Date(); setNotifs((ns) => [{ id: le.getTime(), inst: instActive, instNom, empId: e.id, empNom: e.nom, simule: !e.isFocus, ...c, actions: c.actions.map((texte) => ({ texte, fait: false })), envoyeLe: le, statut: "Envoyée", reponse: null, historique: [{ statut: "Envoyée", le, par: c.conseiller || instNom }] }, ...ns]); };
  const lireNotif = (id) => majNotif(id, (n) => (n.statut === "Envoyée" ? etape(n, "Lue", n.empNom) : n));
  const repondreNotif = (id, type, texte) => majNotif(id, (n) => ({ ...etape(n, "Réponse reçue", n.empNom), reponse: { type, texte, le: new Date() } }));
  const cocherAction = (id, i) => majNotif(id, (n) => ({ ...n, actions: n.actions.map((a, j) => (j === i ? { ...a, fait: !a.fait } : a)) }));
  const cloturerNotif = (id, statut) => majNotif(id, (n) => etape(n, statut, n.conseiller || n.instNom));
  const setModele = (cle, m) => setModeles((ms) => ({ ...ms, [instActive]: { ...(ms[instActive] || {}), [cle]: m } }));
  const resetModele = (cle) => setModeles((ms) => { const { [cle]: _retire, ...reste } = ms[instActive] || {}; return { ...ms, [instActive]: reste }; });

  return (
    <DeviseContext.Provider value={formats}>
    <AujourdhuiContext.Provider value={horloge}>
    <div style={{ background: C.canvas, minHeight: "100vh", color: C.ink }} className="font-sans antialiased">
      <header style={{ background: C.ink }} className="px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: C.teal }}>{espace === "pme" ? <Store size={18} /> : <Landmark size={18} />}</div>
            <div><div className="text-[15px] font-bold leading-tight">{espace === "pme" ? (importe ? nomFocus : "Espace PME") : instNom}</div>
              <div className="text-[11px]" style={{ color: "#9AA7B8" }}>{espace === "pme" ? "Trésorerie & financement" : "VIGIE — risque de portefeuille"}</div></div>
            {espace === "inst" && (<select value={instActive} onChange={(e) => { setInstActive(e.target.value); setSel(null); }} className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-white outline-none" style={{ background: "#1C2E44" }}>{INSTITUTIONS.map((i) => <option key={i.id} value={i.id} style={{ color: C.ink }}>{i.nom}</option>)}</select>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "#1C2E44", color: "#9AA7B8" }} title="Date et heure actuelles : alertes, prévisions et contrôles sont calculés par rapport à elles">
            <CalendarDays size={14} /><span className="font-semibold text-white">{maintenant.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span><span className="hidden sm:inline">· {maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {espace === "pme" && importe && (
            <button onClick={() => setPmeVue("recommandations")} aria-label={nonLues ? `${nonLues} recommandation(s) non lue(s)` : "Recommandations"} className="relative grid h-8 w-8 place-items-center rounded-lg" style={{ background: "#1C2E44" }}>
              <Bell size={15} style={{ color: nonLues ? "#fff" : "#9AA7B8" }} />
              {nonLues > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: C.rouge }}>{nonLues}</span>}
            </button>
          )}
          <label className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "#1C2E44" }} title={devise === "XOF" ? "Afficher les montants dans une autre devise" : texteTaux(devise)}>
            <Coins size={14} style={{ color: "#9AA7B8" }} /><span className="sr-only">Devise d'affichage</span>
            <select value={devise} onChange={(e) => setDevise(e.target.value)} className="max-w-[9.5rem] bg-transparent text-xs font-semibold text-white outline-none">
              {GROUPES_DEVISES.map(([groupe, codes]) => <optgroup key={groupe} label={groupe} style={{ color: C.ink }}>{codes.map((c) => <option key={c} value={c} style={{ color: C.ink }}>{DEVISES[c].sym} · {DEVISES[c].nom}</option>)}</optgroup>)}
            </select>
          </label>
          <div className="flex rounded-lg p-1" style={{ background: "#1C2E44" }}>
            {[["pme", "Espace PME", Store], ["inst", "Espace Institution", Landmark]].map(([id, lbl, Ic]) => (
              <button key={id} onClick={() => { setEspace(id); setSel(null); }} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: espace === id ? "#fff" : "transparent", color: espace === id ? C.ink : "#9AA7B8" }}><Ic size={14} /><span className="hidden sm:inline">{lbl}</span></button>
            ))}
          </div>
          </div>
        </div>
      </header>

      {!selE && (
        <nav className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur" style={{ borderColor: C.hairline }}>
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-8">
            {(espace === "pme"
              ? [["import", "Import", UploadCloud], ["tresorerie", "Ma trésorerie", HeartPulse], ["analyse", "Analyse", Activity], ["rapprochement", "Rapprochement", GitCompareArrows], ["financement", "Mon financement", ShieldCheck], ["recommandations", "Recommandations", Bell]]
              : [["board", "Portefeuille", Layers], ["valider", "À valider", BadgeCheck], ["watch", "Alerte précoce", ShieldAlert], ["liste", "Emprunteurs", Building2], ["suivi", "Suivi", Send]]
            ).map(([id, lbl, Ic]) => { const actif = (espace === "pme" ? pmeVue : instVue) === id; return (
              <button key={id} onClick={() => espace === "pme" ? setPmeVue(id) : setInstVue(id)} className="flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: actif ? C.ink : C.muted, borderBottom: `2px solid ${actif ? C.teal : "transparent"}` }}>
                <Ic size={16} /> {lbl}
                {id === "watch" && agg.watchlist.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.rouge }}>{agg.watchlist.length}</span>}
                {id === "import" && importe && <CheckCircle2 size={13} style={{ color: C.vert }} />}
                {id === "valider" && candidats.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.ambre }}>{candidats.length}</span>}
                {id === "analyse" && importe && resultat.diag.niveau !== "Sain" && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: resultat.diag.niveau === "Alerte précoce" ? C.rouge : C.ambre }}>!</span>}
                {id === "recommandations" && nonLues > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.rouge }}>{nonLues}</span>}
                {id === "suivi" && reponsesAttente > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.ambre }}>{reponsesAttente}</span>}
              </button>); })}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {devise !== "XOF" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "#F0F5F4", border: `1px solid ${C.hairline}`, color: C.muted }}>
            <span className="flex flex-wrap items-center gap-1.5"><Coins size={13} style={{ color: C.teal }} /> Montants affichés en <span className="font-semibold" style={{ color: C.ink }}>{DEVISES[devise].nom} ({DEVISES[devise].sym})</span> · {texteTaux(devise)} · {DEVISES[devise].fixe ? "parité fixe" : `taux indicatif du ${TAUX_DATE}`}</span>
            <button onClick={() => setDevise("XOF")} className="font-semibold" style={{ color: C.teal }}>Revenir au FCFA</button>
          </div>
        )}
        {espace === "pme" ? (
          pmeVue === "import" ? <Import etape={impEtape} setEtape={setImpEtape} source={source} roles={roles} setRoles={setRoles} maps={maps} setMaps={setMaps} resultat={resultat} soldeSaisi={soldeSaisi} setSoldeSaisi={setSoldeSaisi} setEntreprise={(nom) => setSource({ ...source, entreprise: nom })} erreur={erreurImport} onExemple={chargerExemple} onExempleMensuel={chargerExempleMensuel} onFichier={chargerFichier} onReset={() => { setSource(null); setImpEtape(0); setReleveAjoute(null); setErreurImport(null); }} goVue={setPmeVue} />
            : pmeVue === "tresorerie" ? (importe ? <Tresorerie profil={profil} moisCourant={resultat.moisCourant} nbMois={resultat.mois.length} temps={temps} /> : <PromptImport goImport={() => setPmeVue("import")} />)
            : pmeVue === "analyse" ? (importe ? <AnalyseMensuelle resultat={resultat} entreprise={nomFocus} temps={temps} /> : <PromptImport goImport={() => setPmeVue("import")} />)
              : pmeVue === "rapprochement" ? (importe ? <Rapprochement hasReleve={hasReleve} recon={source.recon} releveAjoute={releveAjoute} onAjouter={ajouterReleve} /> : <PromptImport goImport={() => setPmeVue("import")} />)
              : pmeVue === "recommandations" ? (importe ? <Recommandations notifs={notifsPME} onLire={lireNotif} onRepondre={repondreNotif} onCocher={cocherAction} goVue={setPmeVue} /> : <PromptImport goImport={() => setPmeVue("import")} />)
                : (importe ? <Financement profil={profil} histo={vedette.histo} goVue={setPmeVue} institutions={INSTITUTIONS} partages={partages} setPartages={setPartages} valides={valides} /> : <PromptImport goImport={() => setPmeVue("import")} />)
        ) : selE ? <Fiche e={selE} partageActive={!selE.isFocus || partageActive} estCandidat={selE.isFocus && candidats.length > 0} onValider={() => { validerPME(0); setSel(null); setInstVue("liste"); }} onEcarter={() => { ecarterPME(0); setSel(null); }} onBack={() => setSel(null)} inst={inst} modeles={modelesInst} notifs={notifsInst.filter((n) => n.empId === selE.id)} onEnvoyer={(c) => envoyerNotif(selE, c)} />
          : instVue === "board" ? <Board agg={agg} setVue={setInstVue} onOpen={setSel} candidatsCount={candidats.length} instNom={instNom} notifsParEmp={notifsParEmp} />
            : instVue === "valider" ? <AValider candidats={candidats} onOpen={setSel} onValider={(id) => validerPME(id)} onEcarter={(id) => ecarterPME(id)} instNom={instNom} />
            : instVue === "watch" ? <Watch agg={agg} onOpen={setSel} notifsParEmp={notifsParEmp} />
            : instVue === "suivi" ? <Suivi notifs={notifsInst} instNom={instNom} modeles={modelesInst} modelesPerso={modeles[instActive] || {}} setModele={setModele} resetModele={resetModele} onCloturer={cloturerNotif} onOpen={setSel} setVue={setInstVue} />
              : <Liste portefeuille={portefeuille} onOpen={setSel} />}
      </main>

    </div>
    </AujourdhuiContext.Provider>
    </DeviseContext.Provider>
  );
}

function PromptImport({ goImport }) { return <Vide icone={UploadCloud} titre="Importez d'abord vos données" texte="Cet écran s'appuie sur votre fichier de gestion. Passez par l'onglet Import pour connecter vos ventes et dépenses." action="Aller à l'import" onAction={goImport} />; }

/* ============================================================ IMPORT (4 étapes) ============================================================ */
const ETAPES = ["Dépôt", "Correspondance", "Validation", "Profil"];
// fichiers d'exemple servis depuis public/exemples (générés par scripts/generer-exemples.mjs)
const EXEMPLES_FICHIERS = [
  { url: "/exemples/quincaillerie-ndar-6-mois.xlsx", fichier: "quincaillerie-ndar-6-mois.xlsx", libelle: "Excel · feuilles Ventes et Dépenses" },
  { url: "/exemples/journal-caisse-6-mois.csv", fichier: "journal-caisse-6-mois.csv", libelle: "CSV · journal de caisse unique" },
];
const ROLES_FEUILLE = [["ventes", "Ventes (entrées)"], ["depenses", "Dépenses (sorties)"], ["journal", "Journal (entrées et sorties)"], ["ignorer", "Ignorer cette feuille"]];
const LIBELLES_CHAMPS = { date: "Date", montant: "Montant", entree: "Entrées (montant)", sortie: "Sorties (montant)", sens: "Type d'opération", canal: "Canal de paiement", statut: "Statut (payé / impayé)", tiers: "Client / fournisseur", libelle: "Libellé", ref: "Référence unique" };
const BOUTON_RETOUR = "inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium";
const BOUTON_SUITE = "inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";

function Import({ etape, setEtape, source, roles, setRoles, maps, setMaps, resultat, soldeSaisi, setSoldeSaisi, setEntreprise, erreur, onExemple, onExempleMensuel, onFichier, onReset, goVue }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {ETAPES.map((e, i) => (<React.Fragment key={e}>
          <div className="flex items-center gap-2"><div className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: i <= etape ? C.teal : "#EEF0ED", color: i <= etape ? "#fff" : C.muted }}>{i < etape ? "✓" : i + 1}</div><span className="hidden text-xs font-medium sm:inline" style={{ color: i <= etape ? C.ink : C.muted }}>{e}</span></div>
          {i < 3 && <div className="h-px w-5 sm:w-8" style={{ background: C.hairline }} />}
        </React.Fragment>))}
      </div>
      {etape === 0 && <Depot onFichier={onFichier} onExemple={onExemple} onExempleMensuel={onExempleMensuel} erreur={erreur} />}
      {etape === 1 && source && <Correspondance source={source} roles={roles} setRoles={setRoles} maps={maps} setMaps={setMaps} setEntreprise={setEntreprise} onBack={onReset} onNext={() => setEtape(2)} />}
      {etape === 2 && resultat && <Validation resultat={resultat} soldeSaisi={soldeSaisi} setSoldeSaisi={setSoldeSaisi} onBack={() => setEtape(1)} onNext={() => setEtape(3)} />}
      {etape === 3 && resultat && <ProfilImport resultat={resultat} onBack={() => setEtape(2)} onReset={onReset} goVue={goVue} />}
    </div>
  );
}
function Depot({ onFichier, onExemple, onExempleMensuel, erreur }) {
  const [drag, setDrag] = useState(false);
  const { aujourdhui } = useAujourdhui();
  const finEx = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1), debutEx = new Date(finEx.getFullYear(), finEx.getMonth() - 5, 1);
  const exemple = (onClick, Ic, couleur, titre, texte) => (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left hover:bg-[#FAFBFA]" style={{ borderColor: C.hairline }}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: "#F0F5F4" }}><Ic size={18} style={{ color: couleur }} /></div>
      <div><div className="text-sm font-semibold">{titre}</div><div className="text-xs" style={{ color: C.muted }}>{texte}</div></div></button>
  );
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Importez votre fichier de gestion</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>N'importe quel fichier Excel ou CSV contenant une colonne de date : une feuille ventes et une feuille dépenses, un journal de caisse, ou une feuille par mois. VIGIE répertorie tous les mois et analyse leur évolution.</p></div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFichier(e.dataTransfer.files[0]); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: drag ? C.teal : C.hairline, background: drag ? "#F0F5F4" : "#fff" }}>
        <UploadCloud size={32} style={{ color: C.teal }} /><div className="mt-3 text-sm font-semibold">Glissez-déposez votre fichier ici</div>
        <div className="mt-1 text-xs" style={{ color: C.muted }}>ou cliquez pour parcourir · .xlsx, .xlsm, .xls, .csv, .txt</div>
        <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.txt" className="hidden" onChange={(e) => { if (e.target.files[0]) onFichier(e.target.files[0]); e.target.value = ""; }} /></label>
      {erreur && <div className="flex items-start gap-2 rounded-lg p-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: C.rouge }}><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erreur}</div>}
      <div className="flex items-center gap-3"><div className="h-px flex-1" style={{ background: C.hairline }} /><span className="text-xs" style={{ color: C.muted }}>ou essayez un exemple</span><div className="h-px flex-1" style={{ background: C.hairline }} /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {exemple(onExempleMensuel, Activity, C.rouge, "6 derniers mois, en dégradation", `Quincaillerie Ndar · ${libelleMois(cleMois(debutEx))} → ${libelleMois(cleMois(finEx))}`)}
        {exemple(() => onExemple(true), FileSpreadsheet, C.teal, "Un mois, fichier complet", "NPM Multiservices · avec rapprochement")}
        {exemple(() => onExemple(false), Table2, C.ambre, "Un mois, sans rapprochement", "NPM Multiservices · ventes + dépenses")}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: C.muted }}>
        <span>Télécharger les fichiers d'exemple pour tester l'import :</span>
        {EXEMPLES_FICHIERS.map((x) => <a key={x.url} href={x.url} download={x.fichier} className="inline-flex items-center gap-1 font-semibold" style={{ color: C.teal }}><Download size={12} /> {x.libelle}</a>)}
      </div>
    </div>
  );
}
function Correspondance({ source, roles, setRoles, maps, setMaps, setEntreprise, onBack, onNext }) {
  const { montant } = useMontants();
  const actives = source.feuilles.filter((f) => roles[f.nom] !== "ignorer");
  const [onglet, setOnglet] = useState(actives[0]?.nom);
  const f = actives.find((x) => x.nom === onglet) || actives[0];
  const role = f && roles[f.nom], map = f && maps[f.nom];
  const changerRole = (nom, r) => { setRoles({ ...roles, [nom]: r }); if (r !== "ignorer") setMaps({ ...maps, [nom]: autoMap(source.feuilles.find((x) => x.nom === nom).colonnes, r) }); };
  const erreurs = actives.map((x) => [x.nom, manquants(roles[x.nom], maps[x.nom])]).filter(([, m]) => m.length);
  const apercu = useMemo(() => (f && !manquants(role, map).length ? extraireFeuille(f, role, map) : null), [f, role, map]);
  const debitCredit = role === "journal" && [map.entree, map.sortie].some((c) => /d[ée]bit|cr[ée]dit/i.test(c || ""));
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Correspondance des colonnes</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>VIGIE a repéré les feuilles et les colonnes de votre fichier. Vérifiez le rôle de chaque feuille et corrigez une colonne si besoin : c'est ce qui rend l'outil compatible avec n'importe quel format.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="text-xs" style={{ color: C.muted }}>Fichier<div className="mt-1 truncate text-sm font-medium" style={{ color: C.ink }}>{source.fichier}</div></div>
        <label className="text-xs" style={{ color: C.muted }}>Nom de l'entreprise<input value={source.entreprise} onChange={(e) => setEntreprise(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0F766E]" style={{ borderColor: C.hairline, color: C.ink }} /></label>
      </div>
      <Carte>
        <div className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: C.hairline, color: C.muted }}>Feuilles du fichier</div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>{source.feuilles.map((x) => (
          <div key={x.nom} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[1fr_auto_240px]" style={{ borderColor: C.hairline }}>
            <div className="min-w-0 truncate text-sm font-medium">{x.nom}</div>
            <div className="hidden text-xs sm:block" style={{ color: C.muted }}>{x.lignes.length} lignes</div>
            <select aria-label={`Rôle de la feuille ${x.nom}`} value={roles[x.nom]} onChange={(e) => changerRole(x.nom, e.target.value)} className="rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none" style={{ borderColor: C.hairline }}>{ROLES_FEUILLE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>))}</div>
      </Carte>
      {!actives.length ? <div className="rounded-lg p-3 text-sm" style={{ background: "#FFFBEB", color: C.ambre }}>Choisissez au moins une feuille à lire.</div> : (
        <>
          {actives.length > 1 && <div className="flex flex-wrap gap-1">{actives.map((x) => (<button key={x.nom} onClick={() => setOnglet(x.nom)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: f.nom === x.nom ? C.ink : "#fff", color: f.nom === x.nom ? "#fff" : C.muted, border: `1px solid ${C.hairline}` }}>{x.nom}</button>))}</div>}
          <Carte className="divide-y" style={{ borderColor: C.hairline }}>
            {CHAMPS_ROLE(role).map((cle) => { const requis = cle === "date" || (cle === "montant" && role !== "journal"); return (
              <div key={cle} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[220px_1fr]" style={{ borderColor: C.hairline }}>
                <div className="text-sm font-medium">{LIBELLES_CHAMPS[cle]} {requis && <span style={{ color: C.rouge }}>*</span>}</div>
                <select aria-label={LIBELLES_CHAMPS[cle]} value={map[cle] || ""} onChange={(e) => setMaps({ ...maps, [f.nom]: { ...map, [cle]: e.target.value } })} className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: requis && !map[cle] ? "#FCA5A5" : C.hairline }}>
                  <option value="">— non utilisée —</option>{f.colonnes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </div>); })}
          </Carte>
          {role === "journal" && <div className="text-xs leading-relaxed" style={{ color: C.muted }}>Journal : VIGIE lit les colonnes Entrées / Sorties, sinon la colonne de type (vente, achat, loyer…), sinon le signe du montant (négatif = sortie). Sans colonne de statut, chaque opération est considérée comme payée.{debitCredit && " Débit / crédit : le crédit est lu comme une entrée (convention d'un relevé bancaire) ; inversez les colonnes si votre fichier suit la convention comptable."}</div>}
          {apercu && (
            <Carte>
              <div className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: C.hairline, color: C.muted }}>Lecture des premières lignes · {f.nom}</div>
              <div className="overflow-x-auto"><table className="w-full text-left text-xs"><tbody>
                {apercu.valides.slice(0, 4).map((o, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: C.hairline }}>
                    <td className="whitespace-nowrap px-4 py-2">{new Date(`${o.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-2 py-2 font-semibold" style={{ color: o.sens === "ENTREE" ? C.vert : C.rouge }}>{o.sens === "ENTREE" ? "Entrée" : "Sortie"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{montant(o.montant)}</td>
                    <td className="px-2 py-2" style={{ color: C.muted }}>{o.canal}</td>
                    <td className="px-2 py-2" style={{ color: o.statut === "Payé" ? C.muted : C.ambre }}>{o.statut}</td>
                    <td className="max-w-[12rem] truncate px-2 py-2 pr-4" style={{ color: C.muted }}>{o.tiers !== "—" ? o.tiers : o.libelle}</td>
                  </tr>))}
              </tbody></table></div>
              {!apercu.valides.length && <div className="px-4 py-3 text-xs" style={{ color: C.rouge }}>Aucune ligne lisible avec ces colonnes : vérifiez la date et le montant.</div>}
            </Carte>
          )}
        </>
      )}
      {erreurs.length > 0 && <div className="text-xs" style={{ color: C.rouge }}>{erreurs.map(([nom, m]) => `${nom} : indiquez ${m.join(" et ")}`).join(" · ")}</div>}
      <div className="flex justify-between">
        <button onClick={onBack} className={BOUTON_RETOUR} style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <button onClick={onNext} disabled={!actives.length || erreurs.length > 0} className={BOUTON_SUITE} style={{ background: C.ink }}>Valider <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
function Validation({ resultat, soldeSaisi, setSoldeSaisi, onBack, onNext }) {
  const { montant } = useMontants();
  const { nbLignes, nbValides, rejets, mois, soldeDetecte } = resultat;
  const [texteSolde, setTexteSolde] = useState(soldeSaisi != null ? String(soldeSaisi) : "");
  const raisons = Object.entries(rejets.reduce((a, r) => { (a[r.raison] = a[r.raison] || []).push(r); return a; }, {})).sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Validation</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Ce que VIGIE a retenu de votre fichier, et pourquoi certaines lignes ont été écartées.</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[["Lignes lues", nbLignes, C.ink], ["Opérations retenues", nbValides, C.vert], ["Lignes écartées", rejets.length, rejets.length ? C.rouge : C.muted]].map(([l, v, c]) => (
          <Carte key={l} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      {raisons.length > 0 && (
        <Carte className="p-4"><div className="mb-2 text-xs font-semibold" style={{ color: C.muted }}>Lignes écartées</div>
          <ul className="space-y-1 text-sm">{raisons.map(([raison, rs]) => <li key={raison}><span className="font-semibold tabular-nums">{rs.length}</span> · {raison} <span className="text-xs" style={{ color: C.muted }}>({rs.slice(0, 6).map((r) => `${r.feuille} l. ${r.ligne}`).join(", ")}{rs.length > 6 ? "…" : ""})</span></li>)}</ul></Carte>
      )}
      <Carte className="p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><div className="text-xs font-semibold" style={{ color: C.muted }}>Mois répertoriés</div>{mois.length > 0 && <div className="text-xs" style={{ color: C.muted }}>{mois.length} mois · {libelleMois(mois[0].cle)} → {libelleMois(mois[mois.length - 1].cle)}</div>}</div>
        {mois.length ? <div className="flex flex-wrap gap-1.5">{mois.map((m) => <span key={m.cle} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: m.nbOps ? C.hairline : "#FDE68A", background: m.nbOps ? "#fff" : "#FFFBEB", color: m.nbOps ? C.ink : C.ambre }}>{libelleMois(m.cle)} · {m.nbOps ? `${m.nbOps} op.` : "aucune opération"}</span>)}</div>
          : <div className="text-sm" style={{ color: C.rouge }}>Aucune opération retenue : revenez à la correspondance des colonnes.</div>}
      </Carte>
      <Carte className="p-4">
        <label className="block text-xs font-semibold" style={{ color: C.muted }}>Trésorerie disponible au début du fichier <span className="font-normal">(facultatif)</span>
          <input inputMode="numeric" value={texteSolde} placeholder={soldeDetecte != null ? String(soldeDetecte) : "0"} onChange={(e) => { setTexteSolde(e.target.value); setSoldeSaisi(e.target.value.trim() === "" ? null : parseMontant(e.target.value)); }} className="mt-1.5 w-full max-w-xs rounded-lg border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#0F766E]" style={{ borderColor: C.hairline, color: C.ink }} /></label>
        <div className="mt-1.5 text-[11px]" style={{ color: C.muted }}>{soldeDetecte != null ? `Détecté dans le fichier (report à nouveau / solde initial) : ${montant(soldeDetecte)}. Saisissez un autre montant pour le remplacer.` : soldeSaisi != null ? `Non trouvé dans le fichier : le montant saisi (${montant(soldeSaisi)}) est utilisé.` : "Non trouvé dans le fichier : sans lui, la trésorerie part de zéro et les jours de trésorerie sont sous-estimés."}</div>
      </Carte>
      <div className="flex justify-between">
        <button onClick={onBack} className={BOUTON_RETOUR} style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <button onClick={onNext} disabled={!nbValides} className={BOUTON_SUITE} style={{ background: C.ink }}>Voir le profil <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
function ProfilImport({ resultat, onBack, onReset, goVue }) {
  const { court } = useMontants();
  const { aujourdhui } = useAujourdhui();
  const { profil: p, mois, diag } = resultat;
  const t = situerDansLeTemps(mois, diag, aujourdhui);
  const st = ETATS_MOIS[diag.niveau];
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Profil calculé sur vos données</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>{mois.length > 1 ? `${mois.length} mois analysés. Chiffres de ${libelleMois(diag.dernier.cle, true)}, le dernier mois du fichier : ` : `Chiffres de ${libelleMois(diag.dernier.cle, true)} : `}l'argent réellement encaissé, distingué de ce qui reste à recevoir.</p></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Encaissé (réel)", court(p.encaisse), C.vert], ["À recevoir", court(p.creances), C.ambre], ["Décaissé (réel)", court(p.decaisse), C.rouge], ["À payer", court(p.dettes), C.or]].map(([l, v, c], i) => (
          <Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl p-4" style={{ background: st.bg, border: `1px solid ${st.bd}` }}>
        {diag.niveau === "Sain" ? <CheckCircle2 size={18} style={{ color: st.c }} /> : <ShieldAlert size={18} style={{ color: st.c }} />}
        <div className="flex-1 text-sm"><span className="font-semibold" style={{ color: st.c }}>{diag.niveau === "Sain" ? "Import terminé." : diag.niveau === "Alerte précoce" ? "Alerte précoce détectée." : "Point de vigilance détecté."}</span> <span style={{ color: C.muted }}>Score de {diag.dernier.score}/100 en {libelleMois(diag.dernier.cle, true)}{diag.pic ? `, contre ${diag.pic.score} en ${libelleMois(diag.pic.cle, true)}` : ""}. Dernière opération le {dateLongueAn(t.dateDonnees)}, {relatif(-t.joursDepuis)}.</span></div>
        <button onClick={() => goVue("analyse")} className="text-sm font-semibold" style={{ color: C.teal }}>Voir l'analyse mois par mois →</button>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button onClick={onBack} className={BOUTON_RETOUR} style={{ borderColor: C.hairline }}><ArrowLeft size={15} /> Retour</button>
        <div className="flex gap-2">
          <button onClick={onReset} className={BOUTON_RETOUR} style={{ borderColor: C.hairline }}><RefreshCw size={14} /> Autre fichier</button>
          <button onClick={() => goVue(mois.length > 1 ? "analyse" : "tresorerie")} className={BOUTON_SUITE} style={{ background: C.ink }}>{mois.length > 1 ? "Voir l'analyse" : "Voir ma trésorerie"} <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PME : ANALYSE MOIS PAR MOIS ============================================================ */
const ETATS_MOIS = { Sain: { c: C.vert, bg: "#ECFDF5", bd: "#A7F3D0" }, Vigilance: { c: C.ambre, bg: "#FFFBEB", bd: "#FDE68A" }, "Alerte précoce": { c: C.rouge, bg: "#FEF2F2", bd: "#FECACA" } };
const couleurSignal = (s) => (s >= 65 ? C.vert : s >= 45 ? C.or : C.rouge);
function EtatMois({ etat }) { const s = ETATS_MOIS[etat]; return <span className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}` }}>{etat}</span>; }
const COULEUR_FRAICHEUR = { "à jour": C.vert, "à actualiser": C.ambre, ancienne: C.rouge, "dates futures": C.ambre };
function ReperesTemps({ temps: t, diag }) {
  const { montant } = useMontants();
  const { maintenant } = useAujourdhui();
  const der = diag.dernier, enAlerte = der.etat !== "Sain", couleurEtat = enAlerte ? ETATS_MOIS[der.etat].c : C.vert;
  const tuiles = [
    ["Aujourd'hui", maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), `${maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · temps réel`, C.teal],
    ["Données du fichier", `jusqu'au ${dateLongueAn(t.dateDonnees)}`, `${relatif(-t.joursDepuis)} · ${t.fraicheur}`, COULEUR_FRAICHEUR[t.fraicheur]],
    [enAlerte ? der.etat : "Alerte précoce", t.debutEtat ? `active depuis le ${dateLongueAn(t.debutEtat)}` : "aucune en cours", t.debutEtat ? relatif(-t.joursDepuisEtat) : "score stable ou en hausse", couleurEtat],
    ["Prévision de tension", t.dateTension ? `vers le ${dateLongueAn(t.dateTension)}` : "aucune", t.dateTension ? (t.joursAvantTension >= 0 ? relatif(t.joursAvantTension) : `dépassée · ${relatif(t.joursAvantTension)}`) : "trésorerie disponible stable ou en hausse", t.dateTension ? C.rouge : C.vert],
  ];
  const jalons = [["Début du fichier", t.debutFichier, C.muted], t.debutEtat && [der.etat, t.debutEtat, couleurEtat], ["Dernière donnée", t.dateDonnees, C.ink], ["Aujourd'hui", t.aujourdhui, C.teal], t.dateTension && ["Tension prévue", t.dateTension, C.rouge]].filter(Boolean).sort((a, b) => a[1] - b[1]);
  const min = jalons[0][1], max = jalons[jalons.length - 1][1], pos = (d) => (max > min ? ((d - min) / (max - min)) * 100 : 50);
  return (
    <Carte className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} style={{ color: C.teal }} /> Repères dans le temps</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{tuiles.map(([l, v, sous, c]) => (
        <div key={l} className="rounded-lg p-3" style={{ background: C.canvas }}><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-0.5 text-sm font-semibold">{v}</div><div className="text-[11px] font-semibold" style={{ color: c }}>{sous}</div></div>))}</div>
      <div className="relative mx-3 mb-11 mt-12 hidden h-1 rounded-full sm:block" style={{ background: "#CBD2CC" }} role="img" aria-label={"Frise : " + jalons.map(([l, d]) => `${l} ${dateLongueAn(d)}`).join(", ")}>
        {jalons.map(([l, d, c], i) => { const x = pos(d), ancre = x < 10 ? "left-0" : x > 90 ? "right-0 text-right" : "left-1/2 -translate-x-1/2 text-center"; return (
          <div key={l} className="absolute" style={{ left: `${x}%`, top: -6 }}>
            <div className="-ml-2 h-4 w-4 rounded-full border-[3px] bg-white" style={{ borderColor: c }} />
            <div className={"absolute whitespace-nowrap text-[10px] leading-tight " + ancre + (i % 2 ? " top-6" : " bottom-6")}><div className="font-semibold" style={{ color: c }}>{l}</div><div style={{ color: C.muted }}>{dateCourte(d)}</div></div>
          </div>); })}
      </div>
      {t.fraicheur !== "à jour" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs leading-relaxed sm:mt-0" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: C.ambre }} />
          <span>{t.fraicheur === "dates futures" ? "Certaines dates du fichier sont postérieures à aujourd'hui : vérifiez la colonne de date ou l'horloge de l'appareil." : <>Les données s'arrêtent au {dateLongueAn(t.dateDonnees)}, {relatif(-t.joursDepuis)} : l'analyse décrit la situation à cette date, pas celle d'aujourd'hui. Si la tendance des deux derniers mois s'est poursuivie, la trésorerie disponible serait aujourd'hui d'environ <span className="font-semibold">{montant(t.disponibleEstime)}</span> — à confirmer avec un fichier à jour.</>}</span>
        </div>
      )}
    </Carte>
  );
}
function AnalyseMensuelle({ resultat, entreprise, temps: t }) {
  const { montant, court } = useMontants();
  const { mois, diag, solde, soldeDetecte, soldeSaisi } = resultat;
  const st = ETATS_MOIS[diag.niveau], der = diag.dernier;
  const donnees = mois.map((m) => ({ mois: libelleMois(m.cle), encaisse: m.encaisse, decaisse: m.decaisse, score: m.score, etat: m.etat }));
  const titre = { "Alerte précoce": "Alerte précoce : la situation se dégrade", Vigilance: "Vigilance : des signaux faiblissent", Sain: "Situation saine" }[diag.niveau];
  const phrases = [
    diag.pic ? `Le score est passé de ${diag.pic.score} en ${libelleMois(diag.pic.cle, true)} à ${der.score} en ${libelleMois(der.cle, true)} (${diag.chute} points).`
      : mois.length === 1 ? `Votre fichier couvre un seul mois (${libelleMois(der.cle, true)}) : la tendance apparaîtra dès qu'il contiendra au moins deux mois.` : `Score de ${der.score}/100 en ${libelleMois(der.cle, true)}, sans baisse en cours.`,
    t.premiereAlerte && `VIGIE aurait déclenché l'alerte précoce dès le ${dateLongueAn(t.premiereAlerte)} (données de ${libelleMois(diag.premiereAlerte.cle, true)}), ${relatif(-ecartJours(t.aujourdhui, t.premiereAlerte))}.`,
    t.dateTension && (t.joursAvantTension >= 0 ? `Au rythme des deux derniers mois, la trésorerie disponible serait épuisée vers le ${dateLongueAn(t.dateTension)}, ${relatif(t.joursAvantTension)}.` : `Au rythme des deux derniers mois, la trésorerie disponible aurait été épuisée vers le ${dateLongueAn(t.dateTension)}, ${relatif(t.joursAvantTension)} : sans données plus récentes, la situation actuelle est à vérifier en priorité.`),
  ].filter(Boolean);
  const Point = ({ cx, cy, payload }) => <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke={ETATS_MOIS[payload.etat].c} strokeWidth={2.5} />;
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Analyse mois par mois</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>{entreprise} · {mois.length > 1 ? `${mois.length} mois répertoriés, de ${libelleMois(mois[0].cle)} à ${libelleMois(der.cle)}` : `1 mois répertorié (${libelleMois(der.cle)})`} · {mois.reduce((a, m) => a + m.nbOps, 0)} opérations.</p></div>
      <div className="rounded-2xl p-5 sm:p-6" style={{ background: st.bg, border: `1px solid ${st.bd}` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: st.c }}>{diag.niveau === "Sain" ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />} {titre}</div>
            <div className="mt-2 space-y-1 text-sm leading-relaxed">{phrases.map((p) => <p key={p}>{p}</p>)}</div>
            {diag.signauxEnBaisse.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{diag.signauxEnBaisse.map((s) => <span key={s.nom} className="rounded-full bg-white px-2.5 py-1 text-xs" style={{ border: `1px solid ${st.bd}` }}><span className="font-semibold">{s.nom}</span> <span style={{ color: C.muted }}>{s.de} → </span><span className="font-semibold" style={{ color: couleurSignal(s.a) }}>{s.a}</span></span>)}</div>}
          </div>
          <div className="sm:text-right"><div className="text-[11px]" style={{ color: C.muted }}>Score de {libelleMois(der.cle)}</div><div className="font-serif text-4xl font-semibold tabular-nums" style={{ color: st.c }}>{der.score}</div>{der.delta != null && <div className="text-xs"><Trend delta={der.delta} /> <span style={{ color: C.muted }}>sur un mois</span></div>}</div>
        </div>
      </div>
      <ReperesTemps temps={t} diag={diag} />
      <Carte className="p-5">
        <div className="mb-1 text-sm font-semibold">Encaissements, décaissements et score</div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: C.muted }}><span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: C.vert }} /> encaissé</span><span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: "#F2A7A7" }} /> décaissé</span><span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: C.teal }} /> score (échelle de droite)</span><span className="flex items-center gap-1"><span className="h-0 w-3 border-t border-dashed" style={{ borderColor: C.rouge }} /> seuil d'alerte ({SEUIL_ALERTE})</span></div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={donnees} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="m" tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} width={60} axisLine={false} tickLine={false} />
            <YAxis yAxisId="s" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} width={30} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => (n === "score" ? [`${v}/100`, "Score"] : [montant(v), n === "encaisse" ? "Encaissé" : "Décaissé"])} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} cursor={{ fill: "#F5F6F4" }} />
            <ReferenceLine yAxisId="s" y={SEUIL_ALERTE} stroke={C.rouge} strokeDasharray="4 3" />
            <Bar yAxisId="m" dataKey="encaisse" fill={C.vert} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="m" dataKey="decaisse" fill="#F2A7A7" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line yAxisId="s" type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2.4} dot={<Point />} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Carte>
      <Carte>
        <div className="border-b px-5 py-3 text-sm font-semibold" style={{ borderColor: C.hairline }}>Mois par mois</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="text-left text-[11px]" style={{ color: C.muted }}>{["Mois", "Opérations", "Ventes", "Encaissé", "Décaissé", "Solde du mois", "Trésorerie dispo.", "Score", "Évolution", "État"].map((h, i) => <th key={h} className={"px-3 py-2 font-semibold " + (i === 0 ? "pl-5" : "") + (i >= 1 && i <= 7 ? " text-right" : "")}>{h}</th>)}</tr></thead>
          <tbody>{mois.map((m) => (
            <tr key={m.cle} className="border-t" style={{ borderColor: C.hairline }}>
              <td className="whitespace-nowrap py-2.5 pl-5 pr-3 font-medium">{libelleMois(m.cle)}</td>
              <td className="px-3 text-right tabular-nums" style={{ color: m.nbOps ? C.ink : C.ambre }}>{m.nbOps}</td>
              <td className="px-3 text-right tabular-nums">{court(m.ventes)}</td>
              <td className="px-3 text-right tabular-nums" style={{ color: C.vert }}>{court(m.encaisse)}</td>
              <td className="px-3 text-right tabular-nums" style={{ color: C.rouge }}>{court(m.decaisse)}</td>
              <td className="px-3 text-right tabular-nums" style={{ color: m.net >= 0 ? C.ink : C.rouge }}>{m.net > 0 ? "+" : ""}{court(m.net)}</td>
              <td className="px-3 text-right tabular-nums" style={{ color: m.disponible >= 0 ? C.ink : C.rouge }}>{court(m.disponible)}</td>
              <td className="px-3 text-right font-serif text-base font-semibold tabular-nums">{m.score}</td>
              <td className="px-3">{m.delta != null ? <Trend delta={m.delta} /> : <span style={{ color: C.muted }}>—</span>}</td>
              <td className="px-3 pr-5"><EtatMois etat={m.etat} /></td>
            </tr>))}</tbody>
        </table></div>
      </Carte>
      <Carte>
        <div className="border-b px-5 py-3" style={{ borderColor: C.hairline }}><div className="text-sm font-semibold">Les six signaux, mois par mois</div><div className="text-[11px]" style={{ color: C.muted }}>Vert : 65 et plus · ocre : 45 à 64 · rouge : moins de 45 · gris : pas encore assez d'historique pour ce signal</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs">
          <thead><tr style={{ color: C.muted }}><th className="py-2 pl-5 pr-3 text-left font-semibold">Signal (poids)</th>{mois.map((m) => <th key={m.cle} className="px-1 py-2 text-center font-semibold">{libelleMois(m.cle)}</th>)}</tr></thead>
          <tbody>{der.signaux.map((s, j) => (
            <tr key={s.nom} className="border-t" style={{ borderColor: C.hairline }}>
              <td className="whitespace-nowrap py-1.5 pl-5 pr-3 font-medium">{s.nom} <span style={{ color: C.muted }}>· {pct(s.poids)}</span></td>
              {mois.map((m) => { const x = m.signaux[j]; return <td key={m.cle} className="px-1 py-1.5"><div className="rounded-md py-1 text-center font-semibold tabular-nums" title={x.neutre ? "Historique insuffisant : valeur neutre" : undefined} style={x.neutre ? { background: "#EEF0ED", color: C.muted } : { background: couleurSignal(x.score) + "1F", color: couleurSignal(x.score) }}>{x.neutre ? "n.d." : x.score}</div></td>; })}
            </tr>))}</tbody>
        </table></div>
      </Carte>
      <div className="rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: "#fff", border: `1px solid ${C.hairline}`, color: C.muted }}>
        Trésorerie disponible : solde de départ ({soldeSaisi != null ? `saisi : ${montant(solde)}` : soldeDetecte != null ? `détecté dans le fichier : ${montant(solde)}` : "non renseigné, compté à zéro"}) + encaissements − décaissements, moins les factures fournisseurs encore impayées.
        Alerte précoce : score inférieur à {SEUIL_ALERTE} avec une baisse d'au moins {CHUTE_ALERTE} points en un mois, ou de {CHUTE_PIC} points depuis le meilleur des trois mois précédents (règle du portefeuille des institutions, complétée pour les dégradations lentes).
      </div>
    </div>
  );
}

/* ============================================================ PME : TRÉSORERIE ============================================================ */
function Tresorerie({ profil: p, moisCourant, nbMois, temps }) {
  const { montant, court } = useMontants();
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Ma trésorerie · {libelleMois(moisCourant, true)}</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Ce qui est réellement entré, ce qui reste à encaisser, et votre position si tout se règle{nbMois > 1 ? ` — dernier des ${nbMois} mois de votre fichier (voir l'onglet Analyse pour l'évolution)` : ""}. Données jusqu'au {dateLongueAn(temps.dateDonnees)}, {relatif(-temps.joursDepuis)}{temps.fraicheur !== "à jour" ? " : la situation d'aujourd'hui peut être différente" : ""}.</p></div>
      <Carte className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><div className="text-xs font-medium" style={{ color: C.muted }}>Trésorerie nette réalisée (mois)</div><div className="mt-1 font-serif text-3xl font-semibold tabular-nums" style={{ color: p.realise >= 0 ? C.teal : C.rouge }}>{montant(p.realise)}</div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>encaissé − décaissé, hors impayés</div></div>
          <div className="sm:border-l sm:pl-4" style={{ borderColor: C.hairline }}><div className="text-xs font-medium" style={{ color: C.muted }}>Position projetée</div><div className="mt-1 font-serif text-3xl font-semibold tabular-nums" style={{ color: p.projete >= 0 ? C.teal : C.rouge }}>{montant(p.projete)}</div><div className="mt-1 text-[11px]" style={{ color: C.muted }}>+ créances à encaisser − dettes à payer</div></div>
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
  const { court } = useMontants();
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
  const { montant, court } = useMontants();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Lignes du relevé", r.nbReleve, C.ink], ["Rapprochées", `${pct(r.taux)}`, C.vert], ["Non enregistrés", r.releveOrphelins.length, C.rouge], ["À vérifier", r.comptaOrphelins.length, C.ambre]].map(([l, v, c], i) => (
          <Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}
      </div>
      {r.montantNonEnreg > 0 && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle size={18} style={{ color: C.rouge, marginTop: 2 }} />
          <div className="text-sm"><span className="font-semibold" style={{ color: C.rouge }}>{montant(r.montantNonEnreg)} présents sur le relevé mais absents de votre comptabilité.</span></div>
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
function Financement({ profil: p, histo, goVue, institutions, partages, setPartages, valides }) {
  const sante = p.marge > 0.25 ? { l: "Solide", c: C.vert } : p.marge > 0.1 ? { l: "Correct", c: C.or } : { l: "Fragile", c: C.rouge };
  const ind = [["Taux d'encaissement", p.taux, "part des ventes déjà payées", p.taux > 0.7], ["Marge nette", p.marge, "(ventes − charges) / ventes", p.marge > 0.25], ["Poids des charges fixes", p.poidsFixe, "loyer + salaires / ventes", p.poidsFixe < 0.2]];
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Mon financement</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Votre santé financière telle qu'un financeur la lirait — chaque élément expliqué, rien d'obscur.</p></div>
      <Carte className="flex flex-col items-center p-6 text-center">
        <div className="text-xs font-medium" style={{ color: C.muted }}>Votre situation ce mois-ci</div>
        <div className="mt-1 font-serif text-4xl font-semibold" style={{ color: sante.c }}>{sante.l}</div>
      </Carte>
      <Carte className="p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><div className="text-sm font-semibold">Votre évolution sur {histo.length} mois</div><button onClick={() => goVue("analyse")} className="text-xs font-semibold" style={{ color: C.teal }}>Analyse détaillée →</button></div>
        <div className="mb-3 text-[11px]" style={{ color: C.muted }}>Votre score VIGIE, mois par mois.</div>
        {histo.length < 2 ? <div className="rounded-lg p-3 text-sm" style={{ background: C.canvas, color: C.muted }}>Votre fichier couvre un seul mois ({histo[0].mois}, score {histo[0].score}/100) : importez plusieurs mois pour suivre votre évolution.</div> : <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={histo} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs><linearGradient id="gfin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="mois" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} width={28} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v}/100`, "Score"]} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><ReferenceLine y={SEUIL_ALERTE} stroke={C.rouge} strokeDasharray="4 3" /><Area type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2.2} fill="url(#gfin)" dot={{ r: 3, fill: C.teal }} />
          </AreaChart>
        </ResponsiveContainer>}
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
function Board({ agg, setVue, onOpen, candidatsCount, instNom, notifsParEmp }) {
  const { montant, court } = useMontants();
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 sm:p-8" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.rouge }}><ShieldAlert size={18} /> Alerte précoce</div>
            <h1 className="mt-3 font-serif text-2xl font-semibold leading-snug sm:text-3xl">{agg.watchlist.length} emprunteurs à jour, mais en dégradation.</h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>Ils représentent <span className="font-semibold" style={{ color: C.rouge }}>{montant(agg.expoAlerte)}</span> d'exposition invisible au PAR. Leurs signaux de trésorerie se détériorent — la fenêtre pour agir avant l'impayé.</p>
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
            <Tooltip formatter={(v) => montant(v)} cursor={{ fill: "#F5F6F4" }} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Bar dataKey="encours" radius={[0, 4, 4, 0]} fill={C.teal} /></BarChart></ResponsiveContainer></Carte>
        <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Encours par statut de risque</div>
          <ResponsiveContainer width="100%" height={210}><BarChart data={agg.parStatut} margin={{ left: 4, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="statut" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} /><YAxis tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} width={60} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n, p) => [montant(v), `${p.payload.nb} emprunteurs`]} cursor={{ fill: "#F5F6F4" }} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><Bar dataKey="encours" radius={[4, 4, 0, 0]}>{agg.parStatut.map((d, i) => <Cell key={i} fill={STATUTS[d.statut].c} />)}</Bar></BarChart></ResponsiveContainer></Carte>
      </div>
      <Carte><div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: C.hairline }}><div className="text-sm font-semibold">Watchlist — priorités</div><button onClick={() => setVue("watch")} className="text-xs font-medium" style={{ color: C.teal }}>Tout voir →</button></div>
        <div className="divide-y" style={{ borderColor: C.hairline }}>{agg.watchlist.slice(0, 4).map((e) => <LigneWL key={e.id} e={e} onOpen={onOpen} notif={notifsParEmp[e.id]} />)}</div></Carte>
    </div>
  );
}
function LigneWL({ e, onOpen, notif }) {
  const { court } = useMontants();
  return (
    <button onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-[#FAFBFA]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-serif text-sm font-bold" style={{ background: "#F0F5F4", color: C.teal }}>{e.score}</div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{e.nom}</span>{e.isFocus && <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#F0F5F4", color: C.teal }}><Link2 size={10} /> partagé</span>}{notif && <EtatChip etat={notif.statut} icone />}</div><div className="text-[11px]" style={{ color: C.muted }}>{e.secteur} · {e.region}{e.alerteDepuis && ` · alerte depuis le ${dateCourte(e.alerteDepuis)}`}</div></div>
      <div className="hidden text-right sm:block"><div className="text-[11px]" style={{ color: C.muted }}>tension</div><div className="text-sm font-semibold" style={{ color: C.rouge }}>{e.joursAvantStress == null ? "—" : e.joursAvantStress < 0 ? "dépassée" : `J+${e.joursAvantStress}`}</div>{e.dateTension && <div className="text-[10px]" style={{ color: C.muted }}>{dateCourte(e.dateTension)}</div>}</div>
      <div className="hidden sm:block"><Trend delta={e.scoreDelta} /></div>
      <div className="text-right"><div className="font-semibold tabular-nums">{court(e.ead)}</div><div className="text-[11px]" style={{ color: C.muted }}>encours</div></div><ChevronRight size={16} style={{ color: C.muted }} />
    </button>
  );
}
function Watch({ agg, onOpen, notifsParEmp }) {
  const { aujourdhui } = useAujourdhui();
  const { court } = useMontants();
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Alerte précoce</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Emprunteurs à jour — invisibles au PAR — dont les signaux de trésorerie se dégradent. Classés par sévérité × exposition. Situation au {dateLongueAn(aujourdhui)} : délais de tension comptés à partir d'aujourd'hui. Ouvrez un emprunteur pour lui envoyer une recommandation.</p></div>
      <div className="grid grid-cols-3 gap-4">{[["Signalés", agg.watchlist.length, C.rouge], ["Exposition", court(agg.expoAlerte), C.ambre], ["Part encours", pct(agg.expoAlerte / agg.encoursTotal), C.or]].map(([l, v, c], i) => (<Carte key={i} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}</div>
      <Carte><div className="divide-y" style={{ borderColor: C.hairline }}>{agg.watchlist.map((e) => <LigneWL key={e.id} e={e} onOpen={onOpen} notif={notifsParEmp[e.id]} />)}</div></Carte>
    </div>
  );
}
function Liste({ portefeuille, onOpen }) {
  const { court } = useMontants();
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
  const { court } = useMontants();
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
function Fiche({ e, partageActive, estCandidat, onValider, onEcarter, onBack, inst, modeles, notifs, onEnvoyer }) {
  const { montant, court } = useMontants();
  const { aujourdhui } = useAujourdhui();
  const f = useMemo(() => ficheData(e, aujourdhui), [e, aujourdhui]);
  const partage = e.isFocus ? partageActive : true;
  const points = useMemo(() => pointsVigilance(e, f, aujourdhui), [e, f, aujourdhui]);
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: C.teal }}><ArrowLeft size={15} /> Retour au portefeuille</button>
      <Carte className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{e.nom}</h2><StatutChip statut={e.statut} />{e.alertePrecoce && partage && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#FEF2F2", color: C.rouge, border: "1px solid #FECACA" }}><ShieldAlert size={11} /> Alerte précoce{e.alerteDepuis ? ` · depuis le ${dateCourte(e.alerteDepuis)} (${relatif(-ecartJours(aujourdhui, e.alerteDepuis))})` : ""}</span>}</div>
            <div className="mt-1 text-sm" style={{ color: C.muted }}>{e.secteur} · {e.region} · client depuis {e.anciennete} mois · taux {pct(e.taux, 1)}</div></div>
          <div className="flex flex-wrap gap-6">
            <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Encours (EAD)</div><div className="font-serif text-2xl font-semibold tabular-nums">{court(e.ead)}</div></div>
            {partage && <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Score</div><div className="flex items-baseline justify-end gap-1"><span className="font-serif text-2xl font-semibold tabular-nums">{e.score}</span><Trend delta={e.scoreDelta} /></div></div>}
            {partage && <div className="text-right"><div className="text-[11px]" style={{ color: C.muted }}>Perte attendue</div><div className="font-serif text-2xl font-semibold tabular-nums" style={{ color: C.ambre }}>{court(e.ecl)}</div><div className="text-[10px]" style={{ color: C.muted }}>PD {pct(e.pd)} · LGD {pct(e.lgd)}</div></div>}
          </div>
        </div>
        {e.isFocus && <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: partage ? "#F0F5F4" : "#FFFBEB", color: partage ? C.teal : C.ambre, border: `1px solid ${partage ? C.hairline : "#FDE68A"}` }}><Link2 size={13} /> {partage ? `Profil partagé par l'emprunteur${e.donneesDu ? ` · données jusqu'au ${dateLongueAn(e.donneesDu)} (${relatif(-e.joursDepuisDonnees)})` : ""}.` : "Profil non partagé — accès limité à l'encours."}</div>}
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
        <Carte className="p-5"><div className="mb-1 text-sm font-semibold">{f.histo ? `Évolution du score (${f.histo.length} mois)` : "Trésorerie projetée sur 60 jours, à partir d'aujourd'hui"}</div>
          {f.histo ? (
            <div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={f.histo} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs><linearGradient id="ghi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="mois" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} width={28} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v}/100`, "Score"]} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><ReferenceLine y={SEUIL_ALERTE} stroke={C.rouge} strokeDasharray="4 3" /><Area type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2} fill="url(#ghi)" dot={{ r: 3, fill: C.teal }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[11px]" style={{ color: C.muted }}><span>Encaissé {court(f.bridge.encaisse)}</span><span>À recevoir {court(f.bridge.creances)}</span><span>Position {court(f.bridge.projete)}</span></div>
            </div>
          ) : (
            <><div className="mb-3 text-[11px]" style={{ color: C.muted }}>{f.rupture ? `Rupture projetée le ${dateLongueAn(f.rupture.date)}, ${relatif(f.rupture.d)}` : "Pas de rupture projetée sur 60 jours"}</div>
              <ResponsiveContainer width="100%" height={200}><AreaChart data={f.serie} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={f.rupture ? C.rouge : C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={f.rupture ? C.rouge : C.teal} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0ED" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: C.muted }} interval={11} axisLine={false} tickLine={false} /><YAxis tickFormatter={court} tick={{ fontSize: 10, fill: C.muted }} width={60} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => montant(v)} labelFormatter={() => ""} contentStyle={{ borderRadius: 8, border: `1px solid ${C.hairline}`, fontSize: 12 }} /><ReferenceLine y={0} stroke={C.rouge} strokeDasharray="4 3" /><Area type="monotone" dataKey="solde" stroke={f.rupture ? C.rouge : C.teal} strokeWidth={2} fill="url(#gf)" /></AreaChart></ResponsiveContainer></>
          )}
        </Carte>
        <Carte className="p-5"><div className="mb-3 text-sm font-semibold">Décomposition du score</div>
          <div className="space-y-3">{f.signaux.map((s) => (<div key={s.nom}><div className="flex items-baseline justify-between text-sm"><span className="font-medium">{s.nom}</span><span className="tabular-nums" style={{ color: C.muted }}><span className="font-semibold" style={{ color: C.ink }}>{s.score}</span>/100 <span className="text-[10px]">· {pct(s.poids)}{s.neutre ? " · neutre (historique insuffisant)" : ""}</span></span></div><div className="mt-1"><Barre valeur={s.score} couleur={s.score >= 65 ? C.vert : s.score >= 45 ? C.or : C.rouge} /></div></div>))}</div>
        </Carte>
      </div>) : (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: C.muted }}>Profil non partagé — aucun signal disponible.</div>
      )}
      {partage && !estCandidat && <SectionRecommandation e={e} points={points} inst={inst} modeles={modeles} notifs={notifs} onEnvoyer={onEnvoyer} />}
    </div>
  );
}
function ficheData(e, aujourdhui = debutJour(new Date())) {
  const noms = [["Jours de trésorerie", 0.22], ["Régularité des encaissements", 0.20], ["Tendance du CA", 0.15], ["Poids des charges fixes", 0.15], ["Stabilité du solde", 0.14], ["Discipline de trésorerie", 0.14]];
  if (e.isFocus && e.profil) {
    const p = e.profil;
    return { bridge: { encaisse: p.encaisse, creances: p.creances, decaisse: p.decaisse, projete: p.projete }, histo: e.histo, signaux: e.signaux }; // signaux réels du dernier mois
  }
  const r = rng(1000 + e.id); const serie = []; let solde = e.ead * (0.12 + r() * 0.1); const net = e.score > 60 ? 1 : e.score > 50 ? 0.4 : -0.5;
  for (let d = 0; d <= 60; d++) { const date = ajouterJoursA(aujourdhui, d); // projection à partir d'aujourd'hui
    const choc = (d === 22 || d === 44) ? -e.ead * 0.11 : 0; solde += net * (e.ead * 0.004) * (0.6 + r() * 0.8) + choc; serie.push({ d, date, dateLabel: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), solde }); }
  const rupture = serie.find((p) => p.d > 0 && p.solde < 0);
  const signaux = noms.map(([nom, poids]) => ({ nom, poids, score: Math.max(5, Math.min(98, e.score + Math.round((r() - 0.5) * 34))) }));
  return { serie, rupture, signaux };
}

/* ============================================================ RECOMMANDATIONS (alerte précoce → action) ============================================================
   Détecter (alerte précoce) → diagnostiquer (points de vigilance) → recommander (modèles modifiables
   par l'institution, relus par un conseiller avant l'envoi) → dialoguer (réponse de la PME) → mesurer.
   Démo sans serveur : les messages vivent en mémoire ; seule la PME importée a un espace consultable. */
const NIVEAUX = {
  Conseil: { c: C.teal, bg: "#F0F5F4", bd: "#B7D7D3" },
  Vigilance: { c: C.ambre, bg: "#FFFBEB", bd: "#FDE68A" },
  "Action requise": { c: C.rouge, bg: "#FEF2F2", bd: "#FECACA" },
};
const DELAI_DEFAUT = { Conseil: 0, Vigilance: 15, "Action requise": 7 }; // jours laissés pour répondre
const ETATS_NOTIF = { "Envoyée": { c: C.muted, bg: "#EEF0ED" }, "Lue": { c: C.teal, bg: "#F0F5F4" }, "Réponse reçue": { c: C.ambre, bg: "#FFFBEB" }, "Résolue": { c: C.vert, bg: "#ECFDF5" }, "À escalader": { c: C.rouge, bg: "#FEF2F2" } };
const REPONSES = [
  ["compris", "J'ai compris", CheckCheck, null],
  ["plan", "Je propose un plan", ClipboardList, "Décrivez ce que vous comptez faire, et d'ici quand."],
  ["rdv", "Je demande un rendez-vous", CalendarClock, "Indiquez vos disponibilités (jour, heure, à l'agence ou par téléphone)."],
  ["precision", "J'apporte une précision", MessageSquare, "Expliquez ce qui se passe de votre côté."],
];
const PRECISIONS = ["Baisse saisonnière (hivernage, Tabaski, Magal…)", "Un client important a payé en retard", "Achat de stock exceptionnel ce mois-ci"];
const libelleReponse = (type) => REPONSES.find((r) => r[0] === type)[1];
const DELAI_RELANCE = 14; // jours : un même point n'est pas signalé deux fois dans cet intervalle
const DELAI_REVERIF = 15; // jours : revérification des signaux après l'envoi
const ECRAN_POINT = { "Données à actualiser": ["import", "Import"], "Ventes impayées": ["tresorerie", "Ma trésorerie"], "Encaissements non enregistrés": ["rapprochement", "Rapprochement"], "Poids des charges fixes": ["financement", "Mon financement"] };
const MODELES_DEFAUT = {
  "Données à actualiser": { titre: "Merci d'actualiser vos données", texte: "Les dernières données que vous partagez avec nous datent du {valeur} : un fichier à jour nous permettra de vérifier votre situation actuelle.", actions: ["Importer dans VIGIE un fichier de gestion à jour", "Inclure les ventes et dépenses des dernières semaines"] },
  "Tension de trésorerie": { titre: "Une tension de trésorerie est possible", texte: "Au rythme actuel, votre solde pourrait passer sous zéro vers le {valeur}.", actions: ["Prendre rendez-vous avec votre conseiller", "Anticiper les paiements importants des prochaines semaines"] },
  "Jours de trésorerie": { titre: "Votre réserve de trésorerie s'amenuise", texte: "Votre trésorerie disponible couvre moins de jours de charges qu'auparavant ({valeur}).", actions: ["Reporter ou fractionner le prochain achat de stock", "Négocier un délai de paiement avec un fournisseur", "Mettre de côté une partie des encaissements de la semaine"] },
  "Régularité des encaissements": { titre: "Vos rentrées d'argent deviennent irrégulières", texte: "Vos encaissements arrivent par à-coups ces dernières semaines ({valeur}).", actions: ["Relancer les clients qui ont des factures en attente", "Proposer le paiement par Wave ou Orange Money", "Convenir d'un échéancier avec les gros clients"] },
  "Tendance du CA": { titre: "Votre chiffre d'affaires recule", texte: "Vos ventes sont orientées à la baisse ({valeur}).", actions: ["Repérer les produits ou les clients en recul", "Relancer vos clients habituels", "Faire le point avec votre conseiller sur la saison à venir"] },
  "Poids des charges fixes": { titre: "Vos charges fixes pèsent lourd", texte: "Le loyer et les salaires représentent une part élevée de vos ventes ({valeur}).", actions: ["Revoir les charges qui peuvent être réduites ou étalées", "Renégocier le loyer ou son échéance"] },
  "Stabilité du solde": { titre: "Votre solde varie fortement", texte: "Votre solde de trésorerie connaît de fortes variations ({valeur}).", actions: ["Étaler les gros achats sur plusieurs semaines", "Éviter de concentrer plusieurs paiements importants le même jour"] },
  "Discipline de trésorerie": { titre: "Des échéances méritent attention", texte: "Le suivi de vos échéances et de vos règlements mérite attention ({valeur}).", actions: ["Lister les paiements à venir sur 30 jours", "Établir un échéancier avec les fournisseurs concernés"] },
  "Ventes impayées": { titre: "Des ventes restent à encaisser", texte: "Des factures clients restent impayées : {valeur}.", actions: ["Relancer les clients concernés", "Proposer un paiement fractionné ou par mobile money", "Fixer une date limite de règlement"] },
  "Encaissements non enregistrés": { titre: "Des encaissements manquent dans votre comptabilité", texte: "Votre rapprochement fait apparaître des encaissements non enregistrés : {valeur}.", actions: ["Enregistrer ces encaissements dans votre fichier", "Faire le rapprochement à chaque fin de mois"] },
};
const MSG_FCFA = formateurs("XOF"); // les messages sont rédigés en FCFA, la devise de la PME
const dateLongue = (d) => premier(d.toLocaleDateString("fr-FR", d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }));
const dateHeure = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const ajouterJours = (d, j) => new Date(d.getTime() + j * 864e5);
const remplir = (texte, vars) => texte.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// ce que l'institution observe dans les données partagées : projection, signaux faibles, profil, rapprochement
function pointsVigilance(e, f, aujourdhui) {
  const pts = [];
  if (e.isFocus && e.joursDepuisDonnees > SEUILS_FRAICHEUR.aJour) pts.push({ cle: "Données à actualiser", valeur: `${dateLongue(e.donneesDu)}, il y a ${e.joursDepuisDonnees} jours`, grave: e.joursDepuisDonnees > SEUILS_FRAICHEUR.aActualiser });
  const tension = f.rupture ? f.rupture.date : e.dateTension; // projection du portefeuille, ou analyse du fichier de la PME
  if (tension && ecartJours(tension, aujourdhui) >= 0) pts.push({ cle: "Tension de trésorerie", valeur: dateLongue(tension), grave: true }); // une date déjà passée n'est pas une prévision
  [...f.signaux].filter((s) => s.score < 65 && !s.neutre).sort((a, b) => a.score - b.score).forEach((s) => pts.push({ cle: s.nom, valeur: `indicateur à ${s.score}/100`, grave: s.score < 45 }));
  const p = e.profil;
  if (p && p.ventesTotal && p.creances / p.ventesTotal > 0.15) pts.push({ cle: "Ventes impayées", valeur: `${MSG_FCFA.montant(p.creances)}, soit ${pct(p.creances / p.ventesTotal)} des ventes du mois (${pluriel(p.nbCreances, "facture")})` });
  if (e.rappro && e.rappro.nonEnregistre > 0) pts.push({ cle: "Encaissements non enregistrés", valeur: `${MSG_FCFA.montant(e.rappro.nonEnregistre)} (${pluriel(e.rappro.nb, "opération")})` });
  return pts;
}
function niveauDefaut(e) {
  if (e.dpd > 30) return "Action requise";
  if (e.dpd > 0) return "Vigilance";
  if (e.alertePrecoce) return e.joursAvantStress < 20 ? "Action requise" : e.joursAvantStress <= 45 ? "Vigilance" : "Conseil";
  return "Conseil";
}
function rediger(e, instNom, conseiller, pts, modeles) {
  const vars = { pme: e.nom, institution: instNom };
  const lignes = pts.map((pt) => "– " + remplir(modeles[pt.cle].texte, { ...vars, valeur: pt.valeur }));
  const suite = e.dpd === 0
    ? "Aucune échéance n'est en retard : c'est le bon moment pour agir. Les actions ci-dessous peuvent vous aider, et je reste disponible pour en parler."
    : "Nous souhaitons trouver avec vous la meilleure solution. Les actions ci-dessous sont une première piste, et je reste disponible pour en parler.";
  return {
    titre: pts.length === 1 ? remplir(modeles[pts[0].cle].titre, vars) : "Quelques points de vigilance sur votre trésorerie",
    message: `Bonjour ${e.nom},\n\nEn suivant les données de trésorerie que vous partagez avec ${instNom}, nous avons relevé ${pts.length > 1 ? "quelques points de vigilance" : "un point de vigilance"} :\n${lignes.join("\n")}\n\n${suite}\n\n${conseiller} — ${instNom}`,
    actions: [...new Set(pts.flatMap((pt) => modeles[pt.cle].actions.map((a) => a.trim()).filter(Boolean)))],
  };
}
function NiveauChip({ niveau }) { const s = NIVEAUX[niveau]; return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}` }}>{niveau}</span>; }
function EtatChip({ etat, icone }) { const s = ETATS_NOTIF[etat]; return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: s.bg, color: s.c }}>{icone && <Send size={9} />}{etat}</span>; }
const CHAMP = "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E]";
function Etiquette({ children, droite }) { return <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold" style={{ color: C.muted }}><span>{children}</span>{droite}</div>; }

/* ---------- institution : points de vigilance et rédaction, sur la fiche emprunteur ---------- */
function SectionRecommandation({ e, points, inst, modeles, notifs, onEnvoyer }) {
  const [redaction, setRedaction] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const bloques = {}; // point → date du dernier envoi, s'il date de moins de DELAI_RELANCE jours
  notifs.forEach((n) => { if ((new Date() - n.envoyeLe) / 864e5 < DELAI_RELANCE) n.points.forEach((cle) => { if (!bloques[cle] || n.envoyeLe > bloques[cle]) bloques[cle] = n.envoyeLe; }); });
  const disponibles = points.filter((pt) => !bloques[pt.cle]);
  return (
    <Carte className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><Lightbulb size={18} className="mt-0.5 shrink-0" style={{ color: C.ambre }} />
          <div><div className="text-sm font-semibold">Points de vigilance {points.length > 0 && <span className="font-normal" style={{ color: C.muted }}>· {points.length}</span>}</div>
            <div className="mt-0.5 text-xs" style={{ color: C.muted }}>Ce que montrent les données partagées par l'emprunteur. Transformez-les en recommandation : vous relisez et ajustez avant l'envoi.</div></div></div>
        {!redaction && disponibles.length > 0 && <button onClick={() => { setRedaction(true); setEnvoye(false); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.ink }}><Send size={14} /> Préparer une recommandation</button>}
      </div>
      {points.length === 0 ? <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "#ECFDF5", color: C.vert }}>Aucun point de vigilance : les signaux sont au vert.</div> : (
        <ul className="mt-4 divide-y rounded-lg border" style={{ borderColor: C.hairline }}>
          {points.map((pt) => { const b = bloques[pt.cle]; return (
            <li key={pt.cle} className="flex items-start gap-3 px-3 py-2.5 text-sm" style={{ borderColor: C.hairline }}>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: pt.grave ? C.rouge : C.ambre }} />
              <div className="min-w-0 flex-1"><span className="font-medium">{pt.cle}</span> <span style={{ color: C.muted }}>· {pt.valeur}</span>
                {b && <div className="text-[11px]" style={{ color: C.muted }}>Déjà signalé le {dateLongue(b)} — nouvel envoi possible à partir du {dateLongue(ajouterJours(b, DELAI_RELANCE))}</div>}</div>
            </li>); })}
        </ul>
      )}
      {envoye && <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-sm" style={{ background: "#ECFDF5", color: C.vert }}><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>Recommandation envoyée à {e.nom}. {e.isFocus ? "La PME la retrouve dans son espace, onglet Recommandations." : "Elle est enregistrée dans l'onglet Suivi."}</span></div>}
      {redaction && <Redaction e={e} points={disponibles} inst={inst} modeles={modeles} onEnvoyer={(c) => { onEnvoyer(c); setRedaction(false); setEnvoye(true); }} onAnnuler={() => setRedaction(false)} />}
      {notifs.length > 0 && (
        <div className="mt-5"><div className="mb-2 text-xs font-semibold" style={{ color: C.muted }}>Messages envoyés à cet emprunteur</div>
          <div className="divide-y rounded-lg border" style={{ borderColor: C.hairline }}>{notifs.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs" style={{ borderColor: C.hairline }}><span style={{ color: C.muted }}>{dateHeure(n.envoyeLe)}</span><span className="min-w-0 flex-1 truncate font-medium">{n.titre}</span><NiveauChip niveau={n.niveau} /><EtatChip etat={n.statut} /></div>))}</div></div>
      )}
    </Carte>
  );
}
function Redaction({ e, points, inst, modeles, onEnvoyer, onAnnuler }) {
  const [choisis, setChoisis] = useState(() => points.slice(0, 3).map((pt) => pt.cle));
  const [niveau, setNiveau] = useState(() => niveauDefaut(e));
  const [delai, setDelai] = useState(() => DELAI_DEFAUT[niveauDefaut(e)]);
  const [conseiller, setConseiller] = useState(inst.conseiller);
  const [manuel, setManuel] = useState(null); // null : le brouillon suit les modèles ; sinon, texte retouché à la main
  const [nouvelle, setNouvelle] = useState("");
  const retenus = points.filter((pt) => choisis.includes(pt.cle));
  const brouillon = manuel || (retenus.length ? rediger(e, inst.nom, conseiller, retenus, modeles) : { titre: "", message: "", actions: [] });
  const modifier = (champ, v) => setManuel({ ...brouillon, [champ]: v });
  const ajouterAction = () => { if (nouvelle.trim()) { modifier("actions", [...brouillon.actions, nouvelle.trim()]); setNouvelle(""); } };
  const pret = retenus.length > 0 && brouillon.titre.trim() && brouillon.message.trim();
  return (
    <div className="mt-5 grid gap-6 border-t pt-5 lg:grid-cols-2" style={{ borderColor: C.hairline }}>
      <div className="space-y-4">
        <div className="text-sm font-semibold">Rédiger la recommandation</div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold" style={{ color: C.muted }}>Points à inclure</legend>
          <div className="space-y-1.5">{points.map((pt) => (
            <label key={pt.cle} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[#0F766E]" checked={choisis.includes(pt.cle)} onChange={() => setChoisis(choisis.includes(pt.cle) ? choisis.filter((c) => c !== pt.cle) : [...choisis, pt.cle])} /><span>{pt.cle} <span style={{ color: C.muted }}>· {pt.valeur}</span></span></label>))}</div>
          {manuel && <div className="mt-1.5 text-[11px]" style={{ color: C.muted }}>Message retouché à la main : il ne suit plus les points cochés.</div>}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Etiquette>Niveau</Etiquette>
            <div className="flex flex-wrap gap-1">{Object.keys(NIVEAUX).map((nv) => (
              <button key={nv} onClick={() => { setNiveau(nv); setDelai(DELAI_DEFAUT[nv]); }} aria-pressed={niveau === nv} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={niveau === nv ? { background: NIVEAUX[nv].bg, color: NIVEAUX[nv].c, borderColor: NIVEAUX[nv].bd } : { borderColor: C.hairline, color: C.muted }}>{nv}</button>))}</div></div>
          <div><Etiquette>Réponse souhaitée</Etiquette>
            <select aria-label="Délai de réponse souhaité" value={delai} onChange={(ev) => setDelai(Number(ev.target.value))} className={CHAMP} style={{ borderColor: C.hairline }}><option value={0}>Sans délai</option><option value={7}>Sous 7 jours</option><option value={15}>Sous 15 jours</option><option value={30}>Sous 30 jours</option></select></div>
        </div>
        <div><Etiquette>Titre</Etiquette><input aria-label="Titre" value={brouillon.titre} onChange={(ev) => modifier("titre", ev.target.value)} className={CHAMP} style={{ borderColor: C.hairline }} /></div>
        <div><Etiquette droite={manuel && <button onClick={() => setManuel(null)} className="inline-flex items-center gap-1 font-medium" style={{ color: C.teal }}><RotateCcw size={11} /> Repartir des modèles</button>}>Message</Etiquette>
          <textarea aria-label="Message" rows={11} value={brouillon.message} onChange={(ev) => modifier("message", ev.target.value)} className={CHAMP + " leading-relaxed"} style={{ borderColor: C.hairline }} /></div>
        <div><Etiquette>Actions proposées</Etiquette>
          <ul className="space-y-1.5">{brouillon.actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2"><input aria-label={`Action ${i + 1}`} value={a} onChange={(ev) => modifier("actions", brouillon.actions.map((x, j) => (j === i ? ev.target.value : x)))} className={CHAMP + " py-1.5"} style={{ borderColor: C.hairline }} />
              <button onClick={() => modifier("actions", brouillon.actions.filter((_, j) => j !== i))} aria-label="Retirer cette action" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: C.hairline, color: C.muted }}><X size={14} /></button></li>))}</ul>
          <div className="mt-1.5 flex gap-2"><input aria-label="Nouvelle action" value={nouvelle} onChange={(ev) => setNouvelle(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") ajouterAction(); }} placeholder="Ajouter une action…" className={CHAMP + " py-1.5"} style={{ borderColor: C.hairline }} />
            <button onClick={ajouterAction} disabled={!nouvelle.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40" style={{ borderColor: C.hairline }}><Plus size={13} /> Ajouter</button></div></div>
        <div><Etiquette>Signé par</Etiquette><input aria-label="Signé par" value={conseiller} onChange={(ev) => setConseiller(ev.target.value)} className={CHAMP} style={{ borderColor: C.hairline }} /></div>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-semibold">Aperçu côté PME</div>
        <CarteNotif apercu n={{ id: "apercu", instNom: inst.nom, niveau, delai, titre: brouillon.titre, message: brouillon.message, actions: brouillon.actions.filter((a) => a.trim()).map((texte) => ({ texte, fait: false })), points: retenus.map((pt) => pt.cle), envoyeLe: new Date(), statut: "Envoyée", reponse: null }} />
        <div className="rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: C.canvas, color: C.muted }}>
          Rien n'est envoyé automatiquement : la recommandation part seulement quand vous cliquez sur « Envoyer ». Un même point ne peut pas être signalé deux fois en moins de {DELAI_RELANCE} jours.
          {!e.isFocus && " Démo : seule la PME importée dispose d'un espace consultable ; pour cet emprunteur, l'envoi est enregistré dans le Suivi, sans réponse simulée."}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onAnnuler} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: C.hairline }}>Annuler</button>
          <button disabled={!pret} onClick={() => onEnvoyer({ niveau, delai, conseiller, titre: brouillon.titre.trim(), message: brouillon.message.trim(), actions: brouillon.actions.map((a) => a.trim()).filter(Boolean), points: retenus.map((pt) => pt.cle) })} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.vert }}><Send size={14} /> Envoyer à la PME</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- message tel que la PME le reçoit (aussi utilisé comme aperçu) ---------- */
function CarteNotif({ n, apercu = false, onLire, onRepondre, onCocher, goVue }) {
  const { aujourdhui } = useAujourdhui();
  const [ouvert, setOuvert] = useState(apercu);
  const [mode, setMode] = useState(null);
  const [texte, setTexte] = useState("");
  const nv = NIVEAUX[n.niveau];
  const nouveau = !apercu && n.statut === "Envoyée";
  const echeance = n.delai ? ajouterJours(n.envoyeLe, n.delai) : null;
  const liens = Object.values(Object.fromEntries(n.points.filter((cle) => ECRAN_POINT[cle]).map((cle) => [ECRAN_POINT[cle][0], ECRAN_POINT[cle]])));
  const basculer = () => { if (!ouvert && n.statut === "Envoyée") onLire(n.id); setOuvert(!ouvert); };
  const annuler = () => { setMode(null); setTexte(""); };
  const entete = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: nv.bg }}><Landmark size={16} style={{ color: nv.c }} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"><span className="font-semibold" style={{ color: C.ink }}>{n.instNom}</span><NiveauChip niveau={n.niveau} />{nouveau && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: C.rouge }}>Nouveau</span>}<span style={{ color: C.muted }}>{dateHeure(n.envoyeLe)}</span></div>
        <div className="mt-1 text-sm font-semibold">{n.titre || "Sans titre"}</div>
      </div>
    </>
  );
  return (
    <Carte className="overflow-hidden" style={{ borderLeft: `3px solid ${nv.c}` }}>
      {apercu ? <div className="flex items-start gap-3 p-4">{entete}</div>
        : <button onClick={basculer} aria-expanded={ouvert} className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#FAFBFA]">{entete}<ChevronDown size={16} className={"mt-2 shrink-0 transition-transform " + (ouvert ? "rotate-180" : "")} style={{ color: C.muted }} /></button>}
      {ouvert && (
        <div className="space-y-4 border-t px-4 pb-4 pt-3" style={{ borderColor: C.hairline }}>
          <p className="whitespace-pre-line text-sm leading-relaxed">{n.message}</p>
          {n.actions.length > 0 && (
            <div><div className="mb-2 text-xs font-semibold">Actions proposées</div>
              <ul className="space-y-1.5">{n.actions.map((a, i) => (
                <li key={i}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[#0F766E]" checked={a.fait} disabled={apercu} onChange={() => onCocher(n.id, i)} /><span style={{ color: a.fait ? C.muted : C.ink, textDecoration: a.fait ? "line-through" : "none" }}>{a.texte}</span></label></li>))}</ul></div>
          )}
          {echeance && <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: nv.c }}><CalendarClock size={13} /> Réponse souhaitée avant le {dateLongue(echeance)} · {n.reponse ? "répondu" : ecartJours(echeance, aujourdhui) < 0 ? `délai dépassé (${relatif(ecartJours(echeance, aujourdhui))})` : relatif(ecartJours(echeance, aujourdhui))}</div>}
          {!apercu && liens.length > 0 && <div className="flex flex-wrap gap-3">{liens.map(([vue, lbl]) => <button key={vue} onClick={() => goVue(vue)} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: C.teal }}>Voir « {lbl} » <ChevronRight size={13} /></button>)}</div>}
          {n.statut === "Résolue" && <div className="text-xs font-medium" style={{ color: C.vert }}>Point clos par {n.instNom}.</div>}
          {n.statut === "À escalader" && <div className="text-xs font-medium" style={{ color: C.ambre }}>Votre conseiller va vous recontacter.</div>}
          {n.reponse ? (
            <div className="rounded-lg p-3 text-xs" style={{ background: C.canvas }}><span className="font-semibold">Votre réponse · {libelleReponse(n.reponse.type)}</span> <span style={{ color: C.muted }}>· {dateHeure(n.reponse.le)}</span>{n.reponse.texte && <p className="mt-1 whitespace-pre-line text-sm">{n.reponse.texte}</p>}</div>
          ) : mode ? (
            <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: C.hairline }}>
              <div className="text-xs font-semibold">{libelleReponse(mode)}</div>
              {mode === "precision" && <div className="flex flex-wrap gap-1.5">{PRECISIONS.map((pr) => <button key={pr} onClick={() => setTexte(texte ? texte + "\n" + pr : pr)} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: C.hairline, color: C.muted }}>{pr}</button>)}</div>}
              <textarea rows={3} value={texte} onChange={(ev) => setTexte(ev.target.value)} placeholder={REPONSES.find((r) => r[0] === mode)[3]} aria-label={libelleReponse(mode)} className={CHAMP} style={{ borderColor: C.hairline }} />
              <div className="flex justify-end gap-2"><button onClick={annuler} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: C.hairline }}>Annuler</button>
                <button onClick={() => { onRepondre(n.id, mode, texte.trim()); annuler(); }} disabled={!texte.trim()} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: C.ink }}>Envoyer ma réponse</button></div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">{REPONSES.map(([id, lbl, Ic, aide]) => (
              <button key={id} disabled={apercu} onClick={() => (aide ? setMode(id) : onRepondre(n.id, id, ""))} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-default" style={{ borderColor: C.hairline, color: C.ink }}><Ic size={13} style={{ color: C.teal }} /> {lbl}</button>))}</div>
          )}
        </div>
      )}
    </Carte>
  );
}

/* ---------- PME : mes recommandations ---------- */
function Recommandations({ notifs, onLire, onRepondre, onCocher, goVue }) {
  const aTraiter = notifs.filter((n) => !n.reponse && n.statut !== "Résolue").length;
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Mes recommandations</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Les conseils de vos institutions partenaires, établis à partir des données que vous leur partagez. Ils servent à agir tôt : vous pouvez répondre, proposer un plan ou demander un rendez-vous.</p></div>
      {notifs.length === 0 ? <Vide icone={Bell} titre="Aucune recommandation pour l'instant" texte="Quand une institution avec qui vous partagez votre profil vous enverra un conseil, il apparaîtra ici." /> : (
        <>
          {aTraiter > 0 && <div className="text-xs font-semibold" style={{ color: C.ambre }}>{pluriel(aTraiter, "recommandation")} en attente de votre réponse</div>}
          <div className="space-y-3">{notifs.map((n) => <CarteNotif key={n.id} n={n} onLire={onLire} onRepondre={onRepondre} onCocher={onCocher} goVue={goVue} />)}</div>
        </>
      )}
    </div>
  );
}

/* ---------- institution : suivi des messages et modèles ---------- */
function Suivi({ notifs, instNom, modeles, modelesPerso, setModele, resetModele, onCloturer, onOpen, setVue }) {
  const [onglet, setOnglet] = useState("messages");
  const [ouvert, setOuvert] = useState(null);
  const nb = (f) => notifs.filter(f).length;
  const reponses = nb((n) => n.reponse);
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Suivi des recommandations</h2><p className="mt-1 text-sm" style={{ color: C.muted }}>Les messages envoyés par {instNom} à partir de l'alerte précoce, et les réponses des PME. Chaque envoi est relu par un conseiller et horodaté.</p></div>
      <div className="flex gap-1">{[["messages", `Messages (${notifs.length})`], ["modeles", "Modèles"]].map(([id, lbl]) => (
        <button key={id} onClick={() => setOnglet(id)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: onglet === id ? C.ink : "#fff", color: onglet === id ? "#fff" : C.muted, border: `1px solid ${C.hairline}` }}>{lbl}</button>))}</div>
      {onglet === "modeles" ? <Modeles instNom={instNom} modeles={modeles} modelesPerso={modelesPerso} setModele={setModele} resetModele={resetModele} />
        : notifs.length === 0 ? <Vide icone={Send} titre="Aucune recommandation envoyée" texte="Ouvrez un emprunteur depuis l'Alerte précoce : ses points de vigilance y sont listés, prêts à devenir une recommandation." action="Voir l'alerte précoce" onAction={() => setVue("watch")} />
        : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Envoyées", notifs.length, C.ink], ["Lues", nb((n) => n.statut !== "Envoyée"), C.teal], ["Réponses", reponses, C.ambre], ["Taux de réponse", pct(reponses / notifs.length), C.vert]].map(([l, v, c]) => (
              <Carte key={l} className="p-4"><div className="text-[11px] font-medium" style={{ color: C.muted }}>{l}</div><div className="mt-1 font-serif text-2xl font-semibold tabular-nums" style={{ color: c }}>{v}</div></Carte>))}</div>
            <Carte><div className="divide-y" style={{ borderColor: C.hairline }}>{notifs.map((n) => <LigneSuivi key={n.id} n={n} ouvert={ouvert === n.id} onBasculer={() => setOuvert(ouvert === n.id ? null : n.id)} onCloturer={onCloturer} onOpen={onOpen} />)}</div></Carte>
          </>
        )}
    </div>
  );
}
function LigneSuivi({ n, ouvert, onBasculer, onCloturer, onOpen }) {
  const { aujourdhui } = useAujourdhui();
  const reverif = ajouterJours(n.envoyeLe, DELAI_REVERIF), avantReverif = ecartJours(reverif, aujourdhui);
  const clos = n.statut === "Résolue" || n.statut === "À escalader";
  return (
    <div style={{ borderColor: C.hairline }}>
      <button onClick={onBasculer} aria-expanded={ouvert} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-left text-sm hover:bg-[#FAFBFA]">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{n.empNom}</span><NiveauChip niveau={n.niveau} /></div><div className="truncate text-[11px]" style={{ color: C.muted }}>{n.titre}</div></div>
        <span className="text-[11px]" style={{ color: C.muted }}>{dateHeure(n.envoyeLe)}</span><EtatChip etat={n.statut} /><ChevronDown size={15} className={"transition-transform " + (ouvert ? "rotate-180" : "")} style={{ color: C.muted }} />
      </button>
      {ouvert && (
        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <p className="whitespace-pre-line rounded-lg p-3 text-[13px] leading-relaxed" style={{ background: C.canvas }}>{n.message}</p>
            {n.actions.length > 0 && <ul className="space-y-1 text-xs">{n.actions.map((a, i) => <li key={i} className="flex items-center gap-1.5" style={{ color: a.fait ? C.vert : C.muted }}>{a.fait ? <CheckCircle2 size={13} /> : <span className="mx-[2px] h-2.5 w-2.5 rounded-full border" style={{ borderColor: C.muted }} />} {a.texte}{a.fait && " — fait par la PME"}</li>)}</ul>}
          </div>
          <div className="space-y-3 text-xs">
            {n.reponse ? (
              <div className="rounded-lg p-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}><div className="font-semibold" style={{ color: C.ambre }}>Réponse de la PME · {libelleReponse(n.reponse.type)}</div>{n.reponse.texte && <p className="mt-1 whitespace-pre-line text-[13px]" style={{ color: C.ink }}>{n.reponse.texte}</p>}</div>
            ) : <div className="rounded-lg p-3" style={{ background: C.canvas, color: C.muted }}>{n.simule ? "Démo : cet emprunteur n'a pas d'espace PME simulé, aucune réponse n'arrivera." : "En attente de la réponse de la PME."}</div>}
            <div><div className="mb-1 font-semibold" style={{ color: C.muted }}>Historique</div>
              <ol className="space-y-1">{n.historique.map((h, i) => <li key={i} className="flex flex-wrap gap-x-2"><span className="font-semibold" style={{ color: ETATS_NOTIF[h.statut].c }}>{h.statut}</span><span style={{ color: C.muted }}>{dateHeure(h.le)} · {h.par}</span></li>)}</ol></div>
            <div className="flex items-center gap-1.5" style={{ color: C.muted }}><CalendarClock size={13} /> Revérification des signaux prévue le {dateLongue(reverif)} · <span className="font-semibold" style={{ color: avantReverif <= 0 ? C.ambre : C.muted }}>{avantReverif < 0 ? `à faire, en retard (${relatif(avantReverif)})` : avantReverif === 0 ? "à faire aujourd'hui" : relatif(avantReverif)}</span></div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => onOpen(n.empId)} className="rounded-lg border px-3 py-1.5 font-semibold" style={{ borderColor: C.hairline }}>Ouvrir la fiche</button>
              {!clos && <>
                <button onClick={() => onCloturer(n.id, "Résolue")} className="rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: C.vert }}>Marquer résolue</button>
                <button onClick={() => onCloturer(n.id, "À escalader")} className="rounded-lg border px-3 py-1.5 font-semibold" style={{ borderColor: "#FECACA", color: C.rouge }}>À escalader</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Modeles({ instNom, modeles, modelesPerso, setModele, resetModele }) {
  const variable = (v) => <code className="rounded bg-white px-1 text-[12px]" style={{ color: C.ink }}>{`{${v}}`}</code>;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: C.muted }}>Un modèle par point de vigilance : il pré-remplit les recommandations de {instNom}, et le conseiller peut encore tout ajuster avant l'envoi. Variables : {variable("pme")} {variable("valeur")} {variable("institution")}. Les modifications s'appliquent aux prochains messages.</p>
      <div className="grid gap-4 lg:grid-cols-2">{Object.keys(MODELES_DEFAUT).map((cle) => { const m = modeles[cle]; const perso = !!modelesPerso[cle]; return (
        <Carte key={cle} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">{cle}{perso && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: C.canvas, color: C.teal }}>modifié</span>}</div>
            {perso && <button onClick={() => resetModele(cle)} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.muted }}><RotateCcw size={11} /> Réinitialiser</button>}
          </div>
          <div><Etiquette>Titre</Etiquette><input aria-label={`Titre — ${cle}`} value={m.titre} onChange={(ev) => setModele(cle, { ...m, titre: ev.target.value })} className={CHAMP} style={{ borderColor: C.hairline }} /></div>
          <div><Etiquette>Texte</Etiquette><textarea aria-label={`Texte — ${cle}`} rows={2} value={m.texte} onChange={(ev) => setModele(cle, { ...m, texte: ev.target.value })} className={CHAMP} style={{ borderColor: C.hairline }} /></div>
          <div><Etiquette>Actions proposées (une par ligne)</Etiquette><textarea aria-label={`Actions — ${cle}`} rows={3} value={m.actions.join("\n")} onChange={(ev) => setModele(cle, { ...m, actions: ev.target.value.split("\n") })} className={CHAMP} style={{ borderColor: C.hairline }} /></div>
        </Carte>); })}</div>
    </div>
  );
}
