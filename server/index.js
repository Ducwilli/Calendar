import express from "express";
import { resolve } from "node:path";
import { db } from "./db.js";

const app = express();

// ===== Requêtes SQL, préparées une seule fois =====
const lireCalendrier = db.prepare(`
    SELECT id, annee
    FROM calendriers
    WHERE code_partage = ?
`);

const lireCadeau = db.prepare(`
    SELECT texte,
           type_media AS typeMedia,
           lien_media AS lienMedia,
           texte_alt AS texteAlt
    FROM cadeaux
    WHERE calendrier_id = ? AND jour = ?
`);

// ===== Simulation de date (null = vraie date) =====
// Exemple de test : new Date(2026, 11, 7, 10, 0) pour le 7 décembre 2026 à 10 h
const dateSimulee = null;
const decalage = dateSimulee === null ? 0 : dateSimulee - Date.now();

function maintenant() {
    return new Date(Date.now() + decalage);
}

// ===== Calculs =====
const unJour = 1000 * 60 * 60 * 24;

function dernierJourOuvrable(dateCalcule, annee) {
    const premierDecembre = new Date(annee, 11, 1);
    const ecart = dateCalcule - premierDecembre;
    const numeroDuJour = Math.floor(ecart / unJour) + 1;

    if (numeroDuJour <= 0) {
        return 0;
    } else if (numeroDuJour >= 24) {
        return 24;
    } else {
        return numeroDuJour;
    }
}

// ===== Routes de l'API =====
app.get("/api/statut", (requete, reponse) => {
    reponse.json({ statut: "ok" });
});

app.get("/api/calendriers/:code", (requete, reponse) => {
    const calendrier = lireCalendrier.get(requete.params.code);
    if (calendrier === undefined) {
        return reponse.status(404).json({ erreur: "Calendrier introuvable" });
    }

    reponse.json({
        annee: calendrier.annee,
        date: maintenant()
    });
});

app.get("/api/calendriers/:code/cadeaux/:jour", (requete, reponse) => {
    // 1. Le jour demandé est-il valide ?
    const jour = Number(requete.params.jour);
    if (!Number.isInteger(jour) || jour < 1 || jour > 24) {
        return reponse.status(400).json({ erreur: "Jour invalide" });
    }

    // 2. Le calendrier existe-t-il ?
    const calendrier = lireCalendrier.get(requete.params.code);
    if (calendrier === undefined) {
        return reponse.status(404).json({ erreur: "Calendrier introuvable" });
    }

    // 3. Le jour est-il arrivé ?
    if (jour > dernierJourOuvrable(maintenant(), calendrier.annee)) {
        return reponse.status(403).json({ erreur: "Ce jour n'est pas encore arrivé" });
    }

    // 4. Y a-t-il un cadeau ce jour-là ?
    const cadeau = lireCadeau.get(calendrier.id, jour);
    if (cadeau === undefined) {
        return reponse.status(404).json({ erreur: "Aucun cadeau pour ce jour" });
    }

    reponse.json(cadeau);
});

// ===== Pages =====
app.get("/creer", (requete, reponse) => {
    reponse.sendFile(resolve("public/creer.html"));
});

app.get("/", (requete, reponse) => {
    reponse.sendFile(resolve("public/accueil.html"));
});

app.get("/c/:code", (requete, reponse) => {
    const calendrier = lireCalendrier.get(requete.params.code);
    if (calendrier === undefined) {
        return reponse.status(404).send("Ce calendrier n'existe pas. Vérifie le lien qu'on t'a envoyé.");
    }

    reponse.sendFile(resolve("public/index.html"));
});

// ===== Fichiers du site =====
app.use(express.static("public"));

// ===== Démarrage =====
app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});