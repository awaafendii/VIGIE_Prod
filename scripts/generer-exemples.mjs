/* ============================================================
   Génère les fichiers d'exemple de public/exemples/ :
   « Quincaillerie Ndar », entreprise fictive, janvier → juin 2026,
   dont la situation se dégrade à partir d'avril.
   • quincaillerie-ndar-6-mois.xlsx : feuilles Ventes et Dépenses
   • journal-caisse-6-mois.csv : journal de caisse unique (séparateur « ; »,
     dates jj/mm/aaaa, colonnes Entrée / Sortie, report à nouveau en tête)
   Les deux fichiers contiennent les mêmes opérations.
   Usage : node scripts/generer-exemples.mjs
   ============================================================ */
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "node:fs";

const SOLDE_INITIAL = 4500000;
let graine = 20260101;
const alea = () => { let t = (graine += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const choisir = (a) => a[Math.floor(alea() * a.length)];
const arrondi = (n, pas = 500) => Math.round(n / pas) * pas;

const PRODUITS = [["Sac de ciment 50 kg", 4200], ["Barre de fer 10 mm", 3800], ["Tôle ondulée", 6500], ["Pot de peinture 20 L", 28000], ["Carreaux (m²)", 7500], ["Tuyau PVC 100 mm", 9000]];
const CLIENTS = ["Chantier Ouakam — M. Ndiaye", "Entreprise Sall BTP", "GIE Bâtisseurs de Pikine", "Ets Gaye Construction", "Cheikh Mbengue (artisan)", "M. Fall (particulier)", "Sarr & Fils Rénovation"];
const CANAUX = ["Espèces", "Espèces", "Wave", "Wave", "Orange Money", "Virement"];
// par mois : ventes visées, part impayée, poids de la fin de mois, achats de stock, fournisseurs restés impayés
const MOIS = [
  { m: 1, ventes: 8400000, impaye: 0.05, finMois: 0.25, achats: 5000000, fournisseursImpayes: [] },
  { m: 2, ventes: 8300000, impaye: 0.06, finMois: 0.25, achats: 4900000, fournisseursImpayes: [] },
  { m: 3, ventes: 8700000, impaye: 0.06, finMois: 0.27, achats: 5200000, fournisseursImpayes: [] },
  { m: 4, ventes: 7400000, impaye: 0.15, finMois: 0.4, achats: 5800000, fournisseursImpayes: [2] },
  { m: 5, ventes: 6000000, impaye: 0.26, finMois: 0.5, achats: 5600000, fournisseursImpayes: [1] },
  { m: 6, ventes: 4800000, impaye: 0.35, finMois: 0.55, achats: 5000000, fournisseursImpayes: [0] },
];
const date = (m, j) => new Date(Date.UTC(2026, m - 1, j));
const ventes = [], depenses = [];
let nv = 0, nd = 0;
for (const p of MOIS) {
  const jours = new Date(2026, p.m, 0).getDate();
  const n = 16;
  for (let i = 0; i < n; i++) {
    const finDeMois = alea() < p.finMois;
    const jour = finDeMois ? 22 + Math.floor(alea() * (jours - 21)) : 1 + Math.floor(alea() * 21);
    const [produit, prix] = choisir(PRODUITS);
    const montant = arrondi((p.ventes / n) * (0.6 + alea() * 0.8), prix);
    ventes.push({ Date: date(p.m, jour), Client: choisir(CLIENTS), Produit: produit, Montant: montant, Mode: choisir(CANAUX), Statut: alea() < p.impaye ? "Impayé" : "Payé", "N° pièce": `VT-${String(++nv).padStart(3, "0")}` });
  }
  const fournisseurs = ["Grossiste Thiam & Fils", "Comptoir Diop Matériaux", "Fer & Tôles du Cap-Vert"];
  fournisseurs.forEach((f, i) => {
    const montant = arrondi(p.achats * [0.45, 0.3, 0.25][i], 5000);
    depenses.push({ Date: date(p.m, [3, 10, 17][i]), Fournisseur: f, Libellé: "Achat de marchandises", Montant: montant, Mode: "Virement", Statut: p.fournisseursImpayes.includes(i) ? "Impayé" : "Payé", "N° pièce": `AC-${String(++nd).padStart(3, "0")}` });
  });
  const fixe = [["Bailleur", "Loyer du magasin", 350000, 2, "Virement"], ["Personnel", "Salaires du personnel", 700000, 28, "Virement"], ["Senelec", "Électricité", 95000 + Math.round(alea() * 25) * 1000, 12, "Wave"], ["SEN'EAU", "Eau", 30000, 12, "Wave"], ["Orange Sénégal", "Téléphone & Internet", 40000, 15, "Orange Money"], ["Transports Seck", "Livraisons chantiers", arrondi(120000 + alea() * 100000, 5000), 20, "Espèces"]];
  for (const [f, lib, montant, jour, mode] of fixe) depenses.push({ Date: date(p.m, jour), Fournisseur: f, Libellé: lib, Montant: montant, Mode: mode, Statut: p.m === 6 && lib.startsWith("Loyer") ? "Impayé" : "Payé", "N° pièce": `AC-${String(++nd).padStart(3, "0")}` });
}
const parDate = (a, b) => a.Date - b.Date;
ventes.sort(parDate); depenses.sort(parDate);

// ---------- Excel : deux feuilles ----------
const wb = XLSX.utils.book_new();
for (const [nom, lignes] of [["Ventes", ventes], ["Dépenses", depenses]]) {
  const ws = XLSX.utils.json_to_sheet(lignes, { cellDates: true, dateNF: "dd/mm/yyyy" });
  ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, nom);
}
mkdirSync("public/exemples", { recursive: true });
writeFileSync("public/exemples/quincaillerie-ndar-6-mois.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

// ---------- CSV : journal de caisse unique ----------
const jjmmaaaa = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const journal = [
  ...ventes.map((v) => ({ d: v.Date, lib: `Vente — ${v.Produit}`, tiers: v.Client, mode: v.Mode, entree: v.Montant, sortie: "", statut: v.Statut, piece: v["N° pièce"] })),
  ...depenses.map((v) => ({ d: v.Date, lib: v.Libellé, tiers: v.Fournisseur, mode: v.Mode, entree: "", sortie: v.Montant, statut: v.Statut, piece: v["N° pièce"] })),
].sort((a, b) => a.d - b.d || a.piece.localeCompare(b.piece));
const lignes = ["Journal de caisse — Quincaillerie Ndar", "", "Date;Libellé;Tiers;Mode de paiement;Entrée;Sortie;Statut;N° pièce", `01/01/2026;Report à nouveau;;;${milliers(SOLDE_INITIAL)};;;`,
  ...journal.map((o) => [jjmmaaaa(o.d), o.lib, o.tiers, o.mode, o.entree === "" ? "" : milliers(o.entree), o.sortie === "" ? "" : milliers(o.sortie), o.statut, o.piece].join(";"))];
writeFileSync("public/exemples/journal-caisse-6-mois.csv", "﻿" + lignes.join("\r\n") + "\r\n");

console.log(`${ventes.length} ventes, ${depenses.length} dépenses → public/exemples/`);
