# 🎄 Calendar — Calendrier de l'Avent personnalisable

Application web (pensée pour mobile) de calendrier de l'Avent : chaque jour du 1er au 24 décembre, une case s'ouvre et révèle un cadeau (texte, image ou vidéo) choisi par son créateur.

Projet d'entraînement au développement web.

## Fonctionnalités

- Grille de 24 cases, une par jour
- Ouverture de la case du jour et des cases manquées des jours précédents
- Les cases déjà ouvertes restent visibles
- Les cases futures ne peuvent pas être ouvertes (petite animation au clic)
- Compte à rebours avant le 1er décembre
- Écran « Joyeux Noël » après le 24, avec accès aux cadeaux non ouverts

## Avancement

- [ ] **V1 — Front-end seul** : HTML, CSS, JavaScript. Un seul calendrier, cadeaux écrits en dur, cases ouvertes mémorisées dans le navigateur (`localStorage`).
- [ ] **V2 — Avec serveur** : Node.js + base de données. Chaque utilisateur crée son calendrier depuis une page dédiée et le partage avec un identifiant.
- [ ] **V3 — Stack moderne** : réécriture en Next.js, TypeScript et Prisma.

## Idées pour plus tard

- Récapitulatif des cadeaux en PDF

## Lancer le projet

Ouvrir le dossier dans VS Code et lancer `index.html` avec l'extension **Live Server**.

## Structure

```
Calendar/
├── index.html
├── css/style.css
├── js/data.js     → données des cadeaux
├── js/app.js      → logique du calendrier
└── assets/        → images et vidéos
```
