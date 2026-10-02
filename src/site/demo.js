/* ============================================================
   Chiffres affichés dans les aperçus du site.
   Ils sont obtenus avec la logique de src/App.jsx appliquée :
     • au jeu d'exemple PME (NPM Multiservices, juin 2026) ;
     • au portefeuille de démonstration « Sahel Crédit ».
   Si le jeu d'exemple de l'application change, mettre à jour ici.
   ============================================================ */
export const PME = {
  nom: "NPM Multiservices",
  periode: "Juin 2026",
  realise: "40 635 000 FCFA",
  projete: "64 635 000 FCFA",
  flux: [["Encaissé", "121 M", "vert"], ["À recevoir", "39 M", "ambre"], ["Décaissé", "80 M", "rouge"], ["À payer", "15 M", "or"]],
  canaux: [["Virement", "56 M", 47], ["Orange Money", "40 M", 33], ["Espèces", "15 M", 13], ["MTN MoMo", "9,1 M", 7]],
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
    nonEnregistre: "6 850 000 FCFA",
    orphelins: [["Encaissement non identifié", "Orange Money", "2026-06-08", "4,2 M"], ["Virement reçu non rapproché", "Virement", "2026-06-19", "2,6 M"]],
  },
};

export const PORTEFEUILLE = {
  institution: "Sahel Crédit",
  emprunteurs: 47,
  kpis: [["Encours brut", "1,8 Md", "ink"], ["PAR 30", "13 %", "ambre"], ["PAR 90", "7 %", "rouge"], ["Coût du risque", "8 %", "or"]],
  alerte: { nb: 7, exposition: "256 M", part: "14 %" },
  watchlist: [
    { nom: "Cie Mansa Négoce", secteur: "Commerce & distribution", region: "Conakry", score: 43, delta: -21, stress: 16, ead: "98 M" },
    { nom: "Sarl Djoliba Logistique", secteur: "Import-export", region: "Dakar", score: 39, delta: -23, stress: 12, ead: "70 M" },
    { nom: "Sarl Bamtaare Services", secteur: "Services", region: "Thiès", score: 50, delta: -27, stress: 12, ead: "20 M" },
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
