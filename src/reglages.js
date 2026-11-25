/* ============================================================
   VIGIE — réglages persistants (identité, saisons, connecteurs)
   Stockage local (localStorage) : propre à l'appareil, hors serveur.
   ============================================================ */
import { useState, useEffect } from "react";

/* ---------- persistance locale, tolérante aux environnements sans localStorage ---------- */
export function usePersistant(cle, valeurDefaut) {
  const [v, setV] = useState(() => {
    try { const b = localStorage.getItem(cle); return b ? JSON.parse(b) : valeurDefaut; }
    catch { return valeurDefaut; }
  });
  useEffect(() => {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* quota, mode privé… */ }
  }, [cle, v]);
  return [v, setV];
}

export const ORG_DEFAUT = { pme: { nom: "", logo: "" }, inst: {} };

/* ---------- logo : redimensionné côté navigateur pour tenir dans le stockage local ---------- */
export function redimensionnerImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("Choisissez une image (PNG, JPG, SVG…).")); return; }
    const r = new FileReader();
    r.onerror = () => reject(new Error("Lecture de l'image impossible."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible ou endommagée."));
      img.onload = () => {
        const ech = Math.min(1, max / Math.max(img.width, img.height) || 1);
        const w = Math.max(1, Math.round(img.width * ech)), h = Math.max(1, Math.round(img.height * ech));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL("image/png")); } catch { resolve(r.result); }
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ---------- saisons de baisse d'activité déclarées par la PME ---------- */
export const MOIS_NOMS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// baisse = part attendue de recul du chiffre d'affaires sur la période (0 à 1)
export const SAISONS_PRESETS = [
  { nom: "Hivernage (saison des pluies)", moisDebut: 7, moisFin: 9, baisse: 0.25 },
  { nom: "Rentrée scolaire", moisDebut: 9, moisFin: 10, baisse: 0.15 },
  { nom: "Mois du Ramadan", moisDebut: 3, moisFin: 4, baisse: 0.2 },
  { nom: "Après Tabaski (Aïd el-Kébir)", moisDebut: 6, moisFin: 7, baisse: 0.2 },
  { nom: "Fêtes de fin d'année (Noël)", moisDebut: 12, moisFin: 1, baisse: 0.3 },
  { nom: "Magal de Touba", moisDebut: 9, moisFin: 9, baisse: 0.15 },
];
export const saisonVide = () => ({ id: Date.now() + Math.floor(Math.random() * 1000), nom: "", moisDebut: 1, moisFin: 1, baisse: 0.2 });

/* ---------- connecteurs : banques et émetteurs mobile money intégrables ----------
   Chaque entrée décrit une source que VIGIE sait rapprocher via son API.
   La connexion RÉELLE passe par le backend (OAuth / consentement hébergé) :
   aucun secret ni identifiant n'est saisi ni stocké dans le navigateur.
   `canal` sert d'étiquette par défaut des lignes de relevé reçues. */
export const FOURNISSEURS = [
  { id: "openbanking", nom: "Banque — Open Banking / API", type: "banque", couleur: "#0E1B2C", canal: "Virement", note: "Standard DSP2 / agrégateur (compatible API bancaires UEMOA)." },
  { id: "orange", nom: "Orange Money", type: "mobile", couleur: "#F16E00", canal: "Orange Money", note: "API Orange Money Merchant." },
  { id: "wave", nom: "Wave", type: "mobile", couleur: "#1DC8FF", canal: "Wave", note: "API Wave Business." },
  { id: "mtn", nom: "MTN MoMo", type: "mobile", couleur: "#FFCC00", canal: "MTN MoMo", note: "API MTN MoMo Collection." },
  { id: "moov", nom: "Moov Money", type: "mobile", couleur: "#0057B8", canal: "Moov Money", note: "API Moov Money Marchand." },
  { id: "free", nom: "Free Money / Wizall", type: "mobile", couleur: "#C8102E", canal: "Free Money", note: "API agrégateur Free Money / Wizall." },
];
export const trouverFournisseur = (id) => FOURNISSEURS.find((f) => f.id === id) || null;
