/* ============================================================
   VIGIE — lecture des fichiers et analyse mois par mois
   Fonctions pures (sans React), testables hors navigateur.
   • Lecture : Excel (.xlsx, .xlsm, .xls) et texte (.csv, .txt) —
     séparateur et encodage détectés, dates au format français d'abord.
   • Structures reconnues : feuille(s) ventes + feuille(s) dépenses,
     journal(s) de caisse (colonnes entrée/sortie, colonne de type ou
     montant signé), y compris une feuille par mois.
   • Analyse : profil de chaque mois, six signaux, score, tendance,
     dégradation et alerte précoce.
   ============================================================ */
import * as XLSX from "xlsx";

export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));

/* ---------- valeurs : dates, montants, canaux, statuts, sens ---------- */
const MOIS_TEXTE = { janv: 1, janvier: 1, fevr: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };
function iso(y, m, d) {
  if (y < 100) y += 2000;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (y < 1990 || y > 2100 || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// ordre "jm" (15/06/2026, par défaut) ou "mj" (06/15/2026), déduit de toute la colonne
export function ordreDates(valeurs) {
  let jm = false, mj = false;
  for (const v of valeurs) {
    const m = typeof v === "string" && v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) jm = true;
    if (+m[2] > 12) mj = true;
  }
  return mj && !jm ? "mj" : "jm";
}
export function parseDate(v, ordre = "jm") {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") { // numéro de série Excel (jours depuis le 30/12/1899)
    if (v < 20000 || v > 80000) return null;
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400) * 1000);
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const s = norm(v);
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) return ordre === "mj" ? iso(+m[3], +m[1], +m[2]) : iso(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})(?:er)?[\s-]+([a-z]+)\.?[\s-]+(\d{2,4})/))) { const mo = MOIS_TEXTE[m[2]]; return mo ? iso(+m[3], mo, +m[1]) : null; }
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  return null;
}
// « 1 250 000 FCFA », « 1.250.000 », « 1 250 000,50 », « (50 000) », « -50000 F »…
export function parseMontant(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim(), neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s  ']/g, "").replace(/(fcfa|cfa|xof|frs?|f|€|eur|\$|usd)\.?$/i, "").replace(/^(fcfa|xof|€|\$)/i, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); } else if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const p = s.lastIndexOf("."), c = s.lastIndexOf(",");
  if (p >= 0 && c >= 0) { const dec = p > c ? "." : ","; s = s.split(dec === "." ? "," : ".").join("").replace(",", "."); }
  else if (p >= 0 || c >= 0) { const parts = s.split(p >= 0 ? "." : ","); s = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join("") : parts.join("."); }
  const n = Number(s);
  return isFinite(n) ? (neg ? -n : n) : null;
}
export const normCanal = (v) => { const s = norm(v); if (s.includes("virement") || s.includes("banque") || s.includes("cheque")) return "Virement"; if (s.includes("espece") || s.includes("cash") || s.includes("caisse")) return "Espèces"; if (s.includes("orange")) return "Orange Money"; if (s.includes("wave")) return "Wave"; if (s.includes("prelev")) return "Prélèvement"; return "Autre"; };
// sans colonne de statut, ou statut non reconnu : l'opération est considérée comme payée
export const normStatut = (v) => (/(impay|non[ -]?(paye|regle|solde)|attente|a payer|a recevoir|a encaisser|partiel|^du$)/.test(norm(v)) ? "Impayé" : "Payé");
export function classerSens(v) {
  const s = norm(v);
  if (!s) return null;
  if (/(vente|entree|recette|encaiss|credit|apport|recu|versement client|reglement client|paiement client|depot)/.test(s)) return "ENTREE";
  if (/(depense|sortie|achat|charge|decaiss|debit|paiement|frais|salaire|loyer|retrait|approvision|fournisseur)/.test(s)) return "SORTIE";
  return null;
}

/* ---------- lecture du fichier ---------- */
const SYN = {
  date: ["date", "jour", "date operation", "date de l'operation", "date facture", "date valeur", "date de paiement"],
  entree: ["entree", "entrees", "encaissement", "encaissements", "recette", "recettes", "credit", "credits", "montant entree"],
  sortie: ["sortie", "sorties", "decaissement", "decaissements", "depense", "depenses", "debit", "debits", "montant sortie"],
  montant: ["montant", "montant ttc", "ttc", "montant total", "total", "somme", "valeur", "prix total"],
  sens: ["type", "sens", "nature", "categorie", "type d'operation", "mouvement"],
  canal: ["mode", "mode de paiement", "moyen", "moyen de paiement", "canal", "paiement", "reglement", "mode de reglement"],
  statut: ["statut", "etat", "situation", "statut paiement"],
  tiers: ["client", "fournisseur", "tiers", "beneficiaire", "contrepartie", "nom du client"],
  libelle: ["libelle", "produit", "designation", "description", "article", "objet", "motif", "libelle de l'operation"],
  ref: ["cle", "reference", "ref", "piece", "n° piece", "numero", "n°", "no"],
};
const estEnteteDate = (c) => typeof c === "string" && (SYN.date.includes(norm(c)) || norm(c).startsWith("date"));
function construireFeuille(nom, rows) {
  let h = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    if (r.some(estEnteteDate) && r.filter((c) => c != null && c !== "").length >= 2) { h = i; break; }
  }
  if (h < 0) return null;
  const vus = {};
  const colonnes = rows[h].map((c, j) => { let n = c == null || String(c).trim() === "" ? `Colonne ${j + 1}` : String(c).trim(); if (vus[n]) n = `${n} (${++vus[n]})`; else vus[n] = 1; return n; });
  const lignes = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r.every((c) => c == null || c === "")) continue;
    const o = { __ligne: i + 1 };
    colonnes.forEach((c, j) => (o[c] = r[j] ?? null));
    lignes.push(o);
  }
  return { nom, colonnes, lignes };
}
function decoderTexte(buffer) {
  const octets = new Uint8Array(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(octets).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1252").decode(octets); } // exports Excel « CSV (séparateur : point-virgule) »
}
function lireCSV(texte) {
  const premieres = texte.split(/\r?\n/).filter((l) => l.trim()).slice(0, 15);
  const compter = (l, s) => { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (!q && ch === s) n++; } return n; };
  const sep = [";", ",", "\t", "|"].map((s) => [s, premieres.reduce((a, l) => a + compter(l, s), 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (q) { if (ch === '"') { if (texte[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texte[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => (c.trim() === "" ? null : c.trim())));
}
// renvoie les feuilles exploitables (celles qui ont une colonne de date) et le nom de toutes les feuilles
export function lireClasseur(buffer, nomFichier = "") {
  if (/\.(csv|txt|tsv)$/i.test(nomFichier)) {
    const f = construireFeuille(nomFichier.replace(/\.[^.]+$/, ""), lireCSV(decoderTexte(buffer)));
    return { feuilles: f ? [f] : [], nomsFeuilles: [nomFichier] };
  }
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const feuilles = wb.SheetNames.map((nom) => construireFeuille(nom, XLSX.utils.sheet_to_json(wb.Sheets[nom], { header: 1, raw: true, defval: null, blankrows: false }))).filter(Boolean);
  return { feuilles, nomsFeuilles: wb.SheetNames };
}
export const nomDepuisFichier = (n) => { const s = String(n).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- rôle des feuilles et correspondance des colonnes ---------- */
// ventes (entrées), dépenses (sorties), journal (entrées et sorties) ou ignorer
export function rolesAuto(feuilles) {
  const r = {};
  feuilles.forEach((f) => { const n = norm(f.nom); r[f.nom] = /(rappro|releve|lettr|synthese|resume|bilan)/.test(n) ? "ignorer" : /(vente|encaiss|recette|chiffre)/.test(n) ? "ventes" : /(depense|achat|charge|decaiss|fournisseur)/.test(n) ? "depenses" : null; });
  const nommees = Object.values(r).some((x) => x === "ventes" || x === "depenses");
  feuilles.forEach((f) => { if (r[f.nom] == null) r[f.nom] = nommees ? "ignorer" : "journal"; }); // ex. une feuille par mois
  return r;
}
export const CHAMPS_ROLE = (role) => role === "journal" ? ["date", "entree", "sortie", "montant", "sens", "canal", "statut", "tiers", "libelle", "ref"] : ["date", "montant", "canal", "statut", "tiers", "libelle", "ref"];
export function autoMap(colonnes, role) {
  const champs = CHAMPS_ROLE(role), m = {}, pris = new Set();
  const cols = colonnes.map((c) => [c, norm(c)]);
  for (const passe of ["exact", "debut", "contient"]) {
    for (const champ of champs) {
      if (m[champ] || (passe === "contient" && (champ === "sens" || champ === "ref"))) continue;
      const syn = SYN[champ];
      const t = cols.find(([c, n]) => !pris.has(c) && syn.some((s) => (passe === "exact" ? n === s : passe === "debut" ? n.startsWith(s + " ") || n.startsWith(s + "(") : n.includes(s))));
      if (t) { m[champ] = t[0]; pris.add(t[0]); }
    }
  }
  champs.forEach((c) => { if (!m[c]) m[c] = ""; });
  return m;
}
// ce qui manque pour lire une feuille (vide si tout va bien)
export function manquants(role, map) {
  const r = [];
  if (!map.date) r.push("la date");
  if (role === "journal" ? !map.montant && !map.entree && !map.sortie : !map.montant) r.push(role === "journal" ? "un montant (ou des colonnes entrée / sortie)" : "le montant");
  return r;
}

/* ---------- extraction des opérations ---------- */
const LIGNE_TOTAL = /^(total|sous[- ]total|report|a nouveau|solde)/;
const OUVERTURE = /^(solde (initial|d'ouverture|de depart|au)|report( a nouveau)?\b|a nouveau)/;
// renvoie les opérations valides, les lignes rejetées (avec la raison) et le solde d'ouverture s'il figure en tête
export function extraireFeuille(f, role, map) {
  const valides = [], rejets = [], ordre = ordreDates(f.lignes.map((l) => l[map.date]));
  let soldeOuverture = null;
  const rejeter = (l, raison) => rejets.push({ feuille: f.nom, ligne: l.__ligne, raison });
  // une colonne « référence » qui se répète souvent n'est pas un identifiant : on ne s'en sert pas pour les doublons
  const refs = map.ref ? f.lignes.map((l) => l[map.ref]).filter((x) => x != null && x !== "").map(String) : [];
  const refUnique = refs.length > 0 && new Set(refs).size >= refs.length * 0.7;
  const vus = new Set();
  for (const l of f.lignes) {
    const brut = l[map.date];
    const texte = norm([brut, l[map.libelle], l[map.sens], l[map.tiers]].filter((x) => typeof x === "string").join(" | "));
    if (!valides.length && soldeOuverture == null && OUVERTURE.test(texte.replace(/^[\d/.-]+ \| /, ""))) { // « Report à nouveau », « Solde initial »…
      const v = [l[map.entree], l[map.montant]].map(parseMontant).find((x) => x != null) ?? (parseMontant(l[map.sortie]) != null ? -parseMontant(l[map.sortie]) : null);
      if (v != null) { soldeOuverture = v; continue; }
    }
    if (brut == null || brut === "") continue; // ligne sans date : séparateur, note…
    if (typeof brut === "string" && LIGNE_TOTAL.test(norm(brut))) { rejeter(l, "ligne de total ou de report"); continue; }
    const date = parseDate(brut, ordre);
    if (!date) { rejeter(l, "date illisible"); continue; }
    const mvts = [];
    if (role !== "journal") {
      const m = parseMontant(l[map.montant]);
      if (m == null) { rejeter(l, "montant illisible"); continue; }
      if (m <= 0) { rejeter(l, "montant nul ou négatif"); continue; }
      mvts.push([role === "ventes" ? "ENTREE" : "SORTIE", m]);
    } else if (map.entree || map.sortie) {
      const e = parseMontant(l[map.entree]), s = parseMontant(l[map.sortie]);
      if (e) mvts.push([e > 0 ? "ENTREE" : "SORTIE", Math.abs(e)]);
      if (s) mvts.push(["SORTIE", Math.abs(s)]);
      if (!mvts.length) { rejeter(l, "aucun montant"); continue; }
    } else {
      const m = parseMontant(l[map.montant]);
      if (m == null) { rejeter(l, "montant illisible"); continue; }
      if (m === 0) { rejeter(l, "montant nul"); continue; }
      const sens = map.sens ? classerSens(l[map.sens]) || (m < 0 ? "SORTIE" : null) : m < 0 ? "SORTIE" : "ENTREE";
      if (!sens) { rejeter(l, "type d'opération non reconnu"); continue; }
      mvts.push([sens, Math.abs(m)]);
    }
    const ref = refUnique && l[map.ref] != null && l[map.ref] !== "" ? String(l[map.ref]) : null;
    if (ref && vus.has(ref)) { rejeter(l, "doublon"); continue; }
    if (ref) vus.add(ref);
    for (const [sens, montant] of mvts) {
      valides.push({ sens, date, montant, ref, canal: normCanal(l[map.canal]), statut: map.statut ? normStatut(l[map.statut]) : "Payé", tiers: l[map.tiers] != null && l[map.tiers] !== "" ? String(l[map.tiers]) : "—", libelle: l[map.libelle] != null ? String(l[map.libelle]) : "" });
    }
  }
  return { valides, rejets, soldeOuverture };
}

/* ---------- profil d'une période ---------- */
const CHARGE_FIXE = /loyer|bail|salaire|personnel|paie\b/i;
export function calculerProfil(E, S) {
  const s = (a, f) => a.filter(f).reduce((x, y) => x + y.montant, 0);
  const encaisse = s(E, (e) => e.statut === "Payé"), creances = s(E, (e) => e.statut === "Impayé");
  const decaisse = s(S, (e) => e.statut === "Payé"), dettes = s(S, (e) => e.statut === "Impayé");
  const ventesTotal = encaisse + creances;
  const parCanal = {}; E.filter((e) => e.statut === "Payé").forEach((e) => (parCanal[e.canal] = (parCanal[e.canal] || 0) + e.montant));
  const canaux = Object.entries(parCanal).map(([canal, montant]) => ({ canal, montant, part: montant / (encaisse || 1) })).sort((a, b) => b.montant - a.montant);
  const chargesFixes = s(S, (e) => CHARGE_FIXE.test(`${e.libelle} ${e.tiers}`));
  const taux = ventesTotal ? encaisse / ventesTotal : 0;
  const marge = ventesTotal ? (ventesTotal - (decaisse + dettes)) / ventesTotal : 0;
  const poidsFixe = ventesTotal ? chargesFixes / ventesTotal : chargesFixes > 0 ? 1 : 0;
  return { encaisse, creances, decaisse, dettes, ventesTotal, realise: encaisse - decaisse, projete: encaisse - decaisse + creances - dettes, canaux, taux, marge, poidsFixe, chargesFixes, nbCreances: E.filter((e) => e.statut === "Impayé").length };
}

/* ---------- analyse mois par mois ---------- */
export const SIGNAUX = [["Jours de trésorerie", 0.22], ["Régularité des encaissements", 0.20], ["Tendance du CA", 0.15], ["Poids des charges fixes", 0.15], ["Stabilité du solde", 0.14], ["Discipline de trésorerie", 0.14]];
export const SEUIL_ALERTE = 66; // score sous lequel une baisse déclenche l'alerte précoce (même règle que le portefeuille)
export const CHUTE_ALERTE = 11; // baisse sur un mois
export const CHUTE_PIC = 15; // ou baisse depuis le meilleur des trois mois précédents
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const libelleMois = (cle, long = false) => { const [y, m] = cle.split("-").map(Number); return `${(long ? MOIS_LONGS : MOIS_COURTS)[m - 1]} ${y}`; };
export const finDuMois = (cle) => { const [y, m] = cle.split("-").map(Number); return new Date(y, m, 0); };
const moyenne = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const ecartType = (a) => { const m = moyenne(a); return Math.sqrt(moyenne(a.map((x) => (x - m) ** 2))); };

export function analyserMois(E, S, soldeInitial = 0) {
  const presents = [...new Set([...E, ...S].map((x) => x.date.slice(0, 7)))].sort();
  if (!presents.length) return [];
  const cles = []; // tous les mois entre le premier et le dernier, y compris ceux sans aucune opération
  for (let [y, m] = presents[0].split("-").map(Number); ; ) { const k = `${y}-${String(m).padStart(2, "0")}`; cles.push(k); if (k === presents[presents.length - 1]) break; if (++m > 12) { m = 1; y++; } }
  const res = [];
  let cumul = soldeInitial, dettesCumul = 0, dispoPrec = soldeInitial;
  for (const cle of cles) {
    const e = E.filter((x) => x.date.startsWith(cle)), s = S.filter((x) => x.date.startsWith(cle));
    const p = calculerProfil(e, s);
    // une facture fournisseur encore impayée à la date du fichier l'était aussi à la fin du mois :
    // la trésorerie disponible déduit donc les dettes accumulées
    cumul += p.realise; dettesCumul += p.dettes;
    const disponible = cumul - dettesCumul, variation = disponible - dispoPrec; dispoPrec = disponible;
    const jours = finDuMois(cle).getDate();
    const engageJour = (p.decaisse + p.dettes) / jours;
    const joursTreso = engageJour > 0 ? Math.max(0, disponible) / engageJour : disponible > 0 ? 90 : 0;
    const semaines = [0, 0, 0, 0];
    e.filter((x) => x.statut === "Payé").forEach((x) => (semaines[Math.min(3, Math.floor((+x.date.slice(8, 10) - 1) / 7))] += x.montant));
    const cv = moyenne(semaines) > 0 ? ecartType(semaines) / moyenne(semaines) : 1;
    const prec = res.slice(-3);
    const refVentes = prec.length ? moyenne(prec.map((x) => x.ventes)) : 0;
    const varCA = refVentes > 0 ? p.ventesTotal / refVentes - 1 : null;
    const fenetre = [...prec.slice(-2).map((x) => x.net), p.realise];
    const baseVentes = moyenne([...prec.slice(-2).map((x) => x.ventes), p.ventesTotal]) || 1;
    const ratioDettes = p.decaisse + p.dettes > 0 ? p.dettes / (p.decaisse + p.dettes) : 0;
    const valeurs = [
      [clamp(100 * (1 - Math.exp(-joursTreso / 20)))],
      [clamp(0.5 * (100 - cv * 80) + 0.5 * p.taux * 100)],
      varCA == null ? [70, true] : [clamp(70 + varCA * 150)], // neutre sans historique
      [clamp(100 - p.poidsFixe * 250)],
      fenetre.length < 2 ? [75, true] : [clamp(100 - (ecartType(fenetre) / baseVentes) * 200)],
      [clamp(100 - ratioDettes * 200)],
    ];
    const signaux = SIGNAUX.map(([nom, poids], j) => ({ nom, poids, score: valeurs[j][0], neutre: !!valeurs[j][1] }));
    const dates = [...e, ...s].map((x) => x.date).sort();
    res.push({ cle, premiereOp: dates[0] || null, derniereOp: dates[dates.length - 1] || null, nbOps: e.length + s.length, ventes: p.ventesTotal, encaisse: p.encaisse, creances: p.creances, decaisse: p.decaisse, dettes: p.dettes, net: p.realise, cumul, dettesCumul, disponible, variation, joursTreso: Math.round(joursTreso), varCA, signaux, score: Math.round(signaux.reduce((a, x) => a + x.poids * x.score, 0)), profil: p });
  }
  res.forEach((m, i) => {
    const prev = res[i - 1];
    m.delta = prev ? m.score - prev.score : null;
    m.pic = i ? Math.max(...res.slice(Math.max(0, i - 3), i).map((x) => x.score)) : null;
    m.motifs = prev ? m.signaux.map((x, j) => ({ nom: x.nom, de: prev.signaux[j].score, a: x.score })).filter((x, j) => x.a - x.de <= -10 && !m.signaux[j].neutre) : [];
    const baisse = prev && (m.delta <= -CHUTE_ALERTE || m.score - m.pic <= -CHUTE_PIC || (prev.etat === "Alerte précoce" && m.delta <= 0));
    const glissement = i >= 2 && m.score < prev.score && prev.score < res[i - 2].score && m.score - res[i - 2].score <= -8;
    m.etat = m.score < SEUIL_ALERTE && baisse ? "Alerte précoce" : glissement || m.score < 50 ? "Vigilance" : "Sain";
  });
  return res;
}

// synthèse : niveau actuel, début de la dégradation, signaux en cause, tension de trésorerie
export function diagnostiquer(mois) {
  if (!mois.length) return null;
  const der = mois[mois.length - 1];
  let i = mois.length - 1;
  while (i > 0 && mois[i].score < mois[i - 1].score) i--;
  const pic = i < mois.length - 1 ? mois[i] : null; // dernier sommet avant la baisse en cours
  const signauxEnBaisse = pic ? der.signaux.map((s, j) => ({ nom: s.nom, de: pic.signaux[j].score, a: s.score })).filter((s, j) => s.a - s.de <= -10 && !der.signaux[j].neutre).sort((a, b) => (a.a - a.de) - (b.a - b.de)) : [];
  const variationRecente = moyenne(mois.slice(-2).map((m) => m.variation)); // évolution de la trésorerie disponible
  const joursAvantTension = variationRecente < 0 ? Math.max(0, Math.round(der.disponible / (-variationRecente / 30))) : null;
  const premiereAlerte = mois.find((m) => m.etat === "Alerte précoce") || null;
  return { niveau: der.etat, dernier: der, pic, chute: pic ? der.score - pic.score : 0, signauxEnBaisse, variationRecente, joursAvantTension, premiereAlerte, nbMois: mois.length };
}

/* ---------- repères dans le temps : tout est situé par rapport à la date du jour ---------- */
export const JOUR = 864e5;
export const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const ajouterJoursA = (d, j) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + j);
export const ecartJours = (a, b) => Math.round((debutJour(a) - debutJour(b)) / JOUR); // a − b, en jours
export const depuisISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const relatif = (j) => (j === 0 ? "aujourd'hui" : j === 1 ? "demain" : j === -1 ? "hier" : j > 0 ? `dans ${j} jours` : `il y a ${-j} jours`);
export const SEUILS_FRAICHEUR = { aJour: 35, aActualiser: 75 }; // jours écoulés depuis la dernière opération
// une alerte sur le mois M devient visible le lendemain de sa clôture
export const dateDetection = (cle) => ajouterJoursA(finDuMois(cle), 1);
export function situerDansLeTemps(mois, diag, aujourdhui) {
  if (!diag) return null;
  const der = diag.dernier, finDonnees = finDuMois(der.cle);
  const dateDonnees = der.derniereOp ? depuisISO(der.derniereOp) : finDonnees;
  const joursDepuis = ecartJours(aujourdhui, dateDonnees);
  const fraicheur = joursDepuis < 0 ? "dates futures" : joursDepuis <= SEUILS_FRAICHEUR.aJour ? "à jour" : joursDepuis <= SEUILS_FRAICHEUR.aActualiser ? "à actualiser" : "ancienne";
  // début de l'état en cours (série de mois consécutifs dans le même état, hors « Sain »)
  let k = mois.length - 1;
  while (k > 0 && der.etat !== "Sain" && mois[k - 1].etat === der.etat) k--;
  const debutEtat = der.etat !== "Sain" ? dateDetection(mois[k].cle) : null;
  // projection de la trésorerie disponible jusqu'à aujourd'hui, au rythme des deux derniers mois
  const dateTension = diag.joursAvantTension != null ? ajouterJoursA(finDonnees, diag.joursAvantTension) : null;
  const joursProjetes = Math.max(0, ecartJours(aujourdhui, finDonnees));
  return {
    aujourdhui: debutJour(aujourdhui), debutFichier: mois[0].premiereOp ? depuisISO(mois[0].premiereOp) : depuisISO(`${mois[0].cle}-01`),
    dateDonnees, joursDepuis, fraicheur,
    debutEtat, joursDepuisEtat: debutEtat ? ecartJours(aujourdhui, debutEtat) : null,
    premiereAlerte: diag.premiereAlerte ? dateDetection(diag.premiereAlerte.cle) : null,
    dateTension, joursAvantTension: dateTension ? ecartJours(dateTension, aujourdhui) : null,
    joursProjetes, disponibleEstime: der.disponible + (diag.variationRecente || 0) * (joursProjetes / 30),
  };
}
// recale les dates d'un fichier de n mois (utilisé pour que l'exemple intégré couvre les derniers mois écoulés)
export function decalerDates(feuilles, n) {
  if (!n) return feuilles;
  return feuilles.map((f) => {
    const col = f.colonnes.find(estEnteteDate);
    if (!col) return f;
    const ordre = ordreDates(f.lignes.map((l) => l[col]));
    return { ...f, lignes: f.lignes.map((l) => {
      const iso0 = parseDate(l[col], ordre);
      if (!iso0) return l;
      const [y, m, d] = iso0.split("-").map(Number), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = (t % 12) + 1;
      return { ...l, [col]: iso(ny, nm, Math.min(d, new Date(ny, nm, 0).getDate())) };
    }) };
  });
}
