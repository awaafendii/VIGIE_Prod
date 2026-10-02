/* ============================================================
   SITE VIGIE — identité visuelle
   Mêmes valeurs que la constante C de src/App.jsx, complétées
   par les teintes que l'application utilise en dur, pour que
   le site et l'application ne fassent qu'un visuellement.
   ============================================================ */
export const C = {
  ink: "#0E1B2C", ink2: "#1C2E44", inkMuted: "#9AA7B8", canvas: "#F5F6F4",
  vert: "#047857", teal: "#0F766E", tealTint: "#F0F5F4", ambre: "#B45309", or: "#A16207",
  rouge: "#B91C1C", rougeF: "#7F1D1D", muted: "#5B6472", hairline: "#E3E6E2", piste: "#EEF0ED",
};
export const STATUTS = {
  Sain: { c: C.vert, bg: "#ECFDF5", bd: "#A7F3D0" },
  Arriérés: { c: C.or, bg: "#FEFCE8", bd: "#FDE68A" },
  PAR30: { c: C.ambre, bg: "#FFFBEB", bd: "#FDE68A" },
  PAR90: { c: C.rouge, bg: "#FEF2F2", bd: "#FECACA" },
  Douteux: { c: C.rougeF, bg: "#FEF2F2", bd: "#FCA5A5" },
};
export const CANAUX = { Virement: "#0E1B2C", Espèces: C.or, "Orange Money": "#F16E00", "MTN MoMo": "#C99700" };

// route de l'application (routage par ancre : fonctionne sur tout hébergement statique)
export const APP_HREF = "#/app";

export const LIENS = [
  ["#constat", "Le constat"],
  ["#pme", "Espace PME"],
  ["#institution", "Espace Institution"],
  ["#methode", "Méthode"],
  ["#faq", "FAQ"],
];
