# 🎄 Calendar — Calendrier de l'Avent personnalisable

Application web (pensée pour mobile) de calendrier de l'Avent : chaque jour du 1er au 24 décembre, une case s'ouvre et révèle un cadeau (texte, image ou vidéo) choisi par son créateur.

Projet d'entraînement au développement web.

## Fonctionnalités

**Pour la personne qui reçoit le calendrier** (sans compte, avec le lien de partage)
- Grille de 24 cases en mosaïque, sur téléphone comme sur ordinateur
- Ouverture de la case du jour et des cases manquées des jours précédents
- Les cases déjà ouvertes restent marquées (mémorisées dans le navigateur)
- Les cases futures restent verrouillées : le serveur refuse de révéler leur cadeau
- Compte à rebours avant le 1er décembre, écran « Joyeux Noël » après le 24

**Pour le créateur** (avec un compte)
- Inscription, connexion et déconnexion
- Création d'un calendrier : un texte, une photo ou une vidéo par jour
- Page « Mes calendriers » : lien de partage, modification, suppression

## Avancement

- [x] **V1 — Front-end seul** : HTML, CSS, JavaScript. Un seul calendrier, cadeaux écrits en dur, cases ouvertes mémorisées dans le navigateur (`localStorage`). En ligne sur GitHub Pages (branche `main`).
- [ ] **V2 — Avec serveur** (branche `v2`) : Node.js, Express et SQLite. Comptes utilisateurs, calendriers partagés par un code, médias envoyés depuis le site.
  - [x] Serveur et API
  - [x] Base de données
  - [x] Création, modification et suppression de calendriers
  - [x] Envoi d'images et de vidéos
  - [x] Comptes et sessions
  - [x] Finitions : limites d'essais, gestion des erreurs, fuseau horaire
  - [ ] Mise en ligne
- [ ] **V3 — Stack moderne** : réécriture en Next.js, TypeScript et Prisma.

## Lancer le projet (V2)

Il faut [Node.js](https://nodejs.org) (version 22 ou plus récente).

```
npm install          # installe les dépendances (une seule fois)
npm run remplir      # en local uniquement : crée un compte et un calendrier de test
npm run dev          # lance le serveur, qui redémarre à chaque modification
```
⚠️ **Ne jamais lancer `npm run remplir` sur le serveur en ligne** : ce script crée un compte de test dont le mot de passe est écrit dans le code, donc connu de tous. En ligne, crée ton compte depuis la page d'inscription.

Le site est alors sur http://localhost:3000. Le compte de test et le lien du calendrier de test sont affichés par `npm run remplir`.

Pour tester une autre date que la date du jour, modifier `dateSimulee` en haut de `server/index.js`.

## Structure

```
Calendar/
├── server/
│   ├── index.js        → le serveur : routes de l'API et des pages
│   ├── db.js           → la base SQLite et son schéma
│   ├── sessions.js     → sessions, cookies, utilisateur connecté
│   ├── motsDePasse.js  → hachage des mots de passe (scrypt)
│   ├── medias.js       → réception et suppression des fichiers (Multer)
│   ├── limiteur.js     → limitation du nombre d'essais
│   ├── fuseau.js       → fuseau horaire du serveur (Europe/Paris)
│   ├── remplir.js      → script de remplissage de la base de test
│   └── donnees.js      → les données de test
├── public/             → tout ce que le navigateur reçoit
│   ├── *.html          → les pages
│   ├── css/styles.css
│   ├── js/             → un script par page, et le module formulaire-calendrier.js
│   └── assets/         → les médias de test
└── uploads/            → les médias envoyés par les utilisateurs (non versionné)
```

## Idées pour plus tard

- Récapitulatif des cadeaux en PDF
- Mot de passe oublié (nécessite l'envoi d'emails)
