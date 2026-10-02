# VIGIE

Plateforme de trésorerie PME et d'évaluation du risque de crédit.

## Structure
- `/` (`#/`) — site vitrine : `src/site/` (sections dans `sections/`, briques communes dans `components/`, palette dans `theme.js`, chiffres des aperçus dans `demo.js`).
- `#/app` — l'application : `src/App.jsx`, chargée à la demande.
- `src/Root.jsx` aiguille entre les deux (routage par ancre, aucun réglage serveur nécessaire).

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

## Déployer sur Vercel
1. Pousser ce dossier sur un dépôt GitHub.
2. Sur vercel.com : New Project → importer le dépôt.
3. Vercel détecte Vite automatiquement (Build: `npm run build`, Output: `dist`).
4. Deploy → une URL HTTPS est générée.

Déployer plusieurs jours avant toute présentation, ouvrir l'URL une fois pour la mettre en cache, et garder le dossier `dist/` en secours hors-ligne.
