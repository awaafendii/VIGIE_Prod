/* ============================================================
   Chiffres affichés dans les aperçus du site.
   Ils sont obtenus avec la logique de src/App.jsx appliquée :
     • au jeu d'exemple PME (NPM Multiservices, juin 2026) ;
     • au portefeuille de démonstration « Cayor Crédit ».
   Si le jeu d'exemple de l'application change, mettre à jour ici.
   ============================================================ */
// format de fcfa() dans src/App.jsx, avec une espace insécable avant « FCFA »
const fcfa = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + "\u00A0FCFA";

export const PME = {
  nom: "NPM Multiservices",
  periode: "Juin 2026",
  realise: fcfa(4063500),
  projete: fcfa(6463500),
  flux: [["Encaissé", "12 M", "vert"], ["À recevoir", "3,9 M", "ambre"], ["Décaissé", "8,0 M", "rouge"], ["À payer", "1,5 M", "or"]],
  canaux: [["Virement", "5,6 M", 47], ["Orange Money", "4,0 M", 33], ["Espèces", "1,5 M", 13], ["Wave", "905 k", 7]],
  lignes: 27,
  sante: "Solide",
  indicateurs: [
    ["Taux d'encaissement", 76, "part des ventes déjà payées"],
    ["Marge nette", 40, "(ventes − charges) / ventes"],
    ["Poids des charges fixes", 11, "loyer + salaires / ventes"],
  ],
  historique: [["Mars", 67], ["Avril", 55], ["Mai", 73], ["Juin", 77]],
  correspondance: [["Date", "Date"], ["Montant (encaissé)", "Montant"], ["Canal de paiement", "Mode"], ["Statut", "Statut"], ["Contrepartie", "Client"], ["Libellé", "Produit"], ["Référence unique", "Clé"]],
  rapprochement: {
    kpis: [["Lignes du relevé", "9", "ink"], ["Rapprochées", "88 %", "vert"], ["Non enregistrés", "2", "rouge"], ["À vérifier", "1", "ambre"]],
    nonEnregistre: fcfa(685000),
    orphelins: [["Encaissement non identifié", "Orange Money", "2026-06-08", "420 k"], ["Virement reçu non rapproché", "Virement", "2026-06-19", "265 k"]],
  },
};

export const PORTEFEUILLE = {
  institution: "Cayor Crédit",
  emprunteurs: 47,
  kpis: [["Encours brut", "181 M", "ink"], ["PAR 30", "13 %", "ambre"], ["PAR 90", "7 %", "rouge"], ["Coût du risque", "8 %", "or"]],
  alerte: { nb: 7, exposition: "26 M", part: "14 %" },
  watchlist: [
    { nom: "GIE Kaay Négoce", secteur: "Commerce & distribution", region: "Kaolack", score: 43, delta: -21, stress: 16, ead: "9,8 M" },
    { nom: "Sarl Ndakaaru Logistique", secteur: "Import-export", region: "Dakar", score: 39, delta: -23, stress: 12, ead: "7,0 M" },
    { nom: "Sarl Lompoul Services", secteur: "Services", region: "Thiès", score: 50, delta: -27, stress: 12, ead: "2,0 M" },
  ],
};

// pondération des signaux du score (identique à ficheData dans src/App.jsx)
export const SIGNAUX = [
  ["Jours de trésorerie", 22, "Combien de jours l'entreprise tient avec son cash disponible."],
  ["Régularité des encaissements", 20, "Des rentrées d'argent stables plutôt qu'en à-coups."],
  ["Tendance du CA", 15, "Le chiffre d'affaires progresse, stagne ou recule."],
  ["Poids des charges fixes", 15, "La part du loyer et des salaires dans les ventes."],
  ["Stabilité du solde", 14, "L'amplitude des variations du solde de trésorerie."],
  ["Discipline de trésorerie", 14, "Le respect des échéances fournisseurs et des règlements."],
];
