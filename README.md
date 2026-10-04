# VIGIE

Plateforme de trésorerie PME et d'évaluation du risque de crédit.

## Structure
- `/` (`#/`) — site vitrine : `src/site/` (sections dans `sections/`, briques communes dans `components/`, palette dans `theme.js`, chiffres des aperçus dans `demo.js`).
- `#/app` — l'application : `src/App.jsx`, chargée à la demande.
- `src/Root.jsx` aiguille entre les deux (routage par ancre, aucun réglage serveur nécessaire).
- Lecture et analyse mois par mois de n'importe quel fichier Excel/CSV : `src/analyse.js` (fonctions pures). Fichiers d'exemple (juin → septembre 2026) dans `public/exemples/`, régénérés par `node scripts/generer-exemples.mjs`.
- Recommandations (alerte précoce → conseil envoyé à la PME) : section `RECOMMANDATIONS` de `src/App.jsx`, modèles par défaut dans `MODELES_DEFAUT`. Démo en mémoire, sans serveur.
- Devises d'affichage : constante `DEVISES` dans `src/App.jsx` (taux indicatifs datés, à actualiser au besoin ; les données restent en FCFA).

## Lancer en local
```bash
npm install
npm run dev
```
Ouvrir l'URL affichée (http://localhost:5173).

## Construire pour la production
```bash
npm run build
```
Le dossier `dist/` contient l'application prête à héberger. Pour la tester sans serveur :
```bash
npm run preview
```

## En ligne
- Production : https://vigie-app-snowy.vercel.app (application : `#/app`)
- Dépôt : https://github.com/awaafendii/VIGIE_Prod
- Vercel (projet `vigie-app`, équipe DIGI_GN) est relié au dépôt : chaque `git push` sur `main` redéploie la production automatiquement (Build : `npm run build`, Output : `dist`).

Déployer plusieurs jours avant toute présentation, ouvrir l'URL une fois pour la mettre en cache, et garder le dossier `dist/` en secours hors-ligne.
