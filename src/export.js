/* ============================================================
   VIGIE — export des historiques et des données
   Excel (.xlsx multi-feuilles) et CSV (séparateur « ; », BOM UTF-8
   pour Excel FR). Montants en nombres bruts (FCFA), dates ISO.
   ============================================================ */
import * as XLSX from "xlsx";
import { libelleMois } from "./analyse.js";

const horodatage = () => new Date().toISOString().slice(0, 10);
const assainir = (s) => String(s || "vigie").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "vigie";

/* ---------- primitives de téléchargement ---------- */
export function telechargerClasseur(feuilles, nomFichier) {
  const wb = XLSX.utils.book_new();
  feuilles.forEach(({ nom, lignes }) => {
    const ws = XLSX.utils.json_to_sheet(lignes && lignes.length ? lignes : [{ "(aucune donnée)": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, String(nom).slice(0, 31));
  });
  XLSX.writeFile(wb, nomFichier);
}
export function telechargerCSV(lignes, nomFichier) {
  const ws = XLSX.utils.json_to_sheet(lignes && lignes.length ? lignes : [{ "(aucune donnée)": "" }]);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PME : analyse mois par mois + opérations + prévision ---------- */
function lignesMois(mois) {
  return mois.map((m) => ({
    Mois: libelleMois(m.cle), "Clé mois": m.cle, Opérations: m.nbOps,
    Ventes: m.ventes, Encaissé: m.encaisse, "À recevoir": m.creances,
    Décaissé: m.decaisse, "À payer": m.dettes, "Solde du mois": m.net,
    "Trésorerie disponible": m.disponible, "Jours de trésorerie": m.joursTreso,
    Score: m.score, Évolution: m.delta == null ? "" : m.delta, État: m.etat,
  }));
}
function lignesOperations(resultat) {
  const l = (o, sens) => ({ Date: o.date, Sens: sens, Montant: o.montant, Canal: o.canal, Statut: o.statut, Tiers: o.tiers === "—" ? "" : o.tiers, Libellé: o.libelle || "" });
  return [...resultat.entrees.map((o) => l(o, "Entrée")), ...resultat.sorties.map((o) => l(o, "Sortie"))]
    .sort((a, b) => a.Date.localeCompare(b.Date));
}
function lignesPrevision(prevision) {
  if (!prevision) return [];
  return prevision.futur.map((f, i) => ({
    Horizon: `N+${i + 1}`, Mois: f.label, "Clé mois": f.cle,
    "Encaissements prévus": f.encaisse, "Décaissements prévus": f.decaisse,
    "Solde prévu": f.net, "Trésorerie projetée": f.disponible,
    "Fourchette basse": f.bas, "Fourchette haute": f.haut, Saison: f.saison || "",
  }));
}
export function exporterAnalysePME(resultat, prevision, nomEntreprise, format = "xlsx") {
  const { mois, diag, solde } = resultat;
  const base = `vigie-${assainir(nomEntreprise)}-${horodatage()}`;
  if (format === "csv") { telechargerCSV(lignesMois(mois), `${base}-mois.csv`); return; }
  const synthese = [
    { Clé: "Entreprise", Valeur: nomEntreprise },
    { Clé: "Export réalisé le", Valeur: horodatage() },
    { Clé: "Mois analysés", Valeur: mois.length },
    { Clé: "Période", Valeur: mois.length ? `${libelleMois(mois[0].cle)} → ${libelleMois(mois[mois.length - 1].cle)}` : "" },
    { Clé: "Trésorerie de départ", Valeur: solde },
    { Clé: "Score du dernier mois", Valeur: diag ? diag.dernier.score : "" },
    { Clé: "État", Valeur: diag ? diag.niveau : "" },
    { Clé: "Trésorerie disponible (dernier mois)", Valeur: diag ? diag.dernier.disponible : "" },
  ];
  const feuilles = [
    { nom: "Synthèse", lignes: synthese },
    { nom: "Mois", lignes: lignesMois(mois) },
    { nom: "Opérations", lignes: lignesOperations(resultat) },
  ];
  if (prevision) feuilles.push({ nom: "Prévision N+1 à N+3", lignes: lignesPrevision(prevision) });
  telechargerClasseur(feuilles, `${base}.xlsx`);
}

/* ---------- Institution : portefeuille et watchlist ---------- */
function lignesPortefeuille(portefeuille) {
  return portefeuille.map((e) => ({
    Emprunteur: e.nom, Secteur: e.secteur, Région: e.region, Statut: e.statut,
    Score: e.score, Évolution: e.scoreDelta, "Retard (jours)": e.dpd,
    "Encours (EAD)": e.ead, "Taux": e.taux, "PD": e.pd, "LGD": e.lgd,
    "Perte attendue (ECL)": Math.round(e.ecl),
    "Alerte précoce": e.alertePrecoce ? "oui" : "non",
    "Jours avant tension": e.joursAvantStress == null ? "" : e.joursAvantStress,
    "Profil partagé": e.isFocus ? "oui" : "non",
  }));
}
export function exporterPortefeuille(portefeuille, agg, instNom, format = "xlsx") {
  const base = `vigie-portefeuille-${assainir(instNom)}-${horodatage()}`;
  if (format === "csv") { telechargerCSV(lignesPortefeuille(portefeuille), `${base}.csv`); return; }
  const synthese = [
    { Indicateur: "Institution", Valeur: instNom },
    { Indicateur: "Export réalisé le", Valeur: horodatage() },
    { Indicateur: "Emprunteurs", Valeur: portefeuille.length },
    { Indicateur: "Encours total", Valeur: agg.encoursTotal },
    { Indicateur: "PAR 30", Valeur: agg.par30 },
    { Indicateur: "PAR 90", Valeur: agg.par90 },
    { Indicateur: "Coût du risque", Valeur: agg.coutRisque },
    { Indicateur: "Perte attendue totale (ECL)", Valeur: Math.round(agg.eclTotal) },
    { Indicateur: "Exposition sous alerte précoce", Valeur: agg.expoAlerte },
  ];
  telechargerClasseur([
    { nom: "Synthèse", lignes: synthese },
    { nom: "Portefeuille", lignes: lignesPortefeuille(portefeuille) },
    { nom: "Alerte précoce", lignes: lignesPortefeuille(agg.watchlist) },
  ], `${base}.xlsx`);
}
