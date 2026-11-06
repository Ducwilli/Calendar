import express from "express";
import { calendrierAvent } from "./donnees.js";

const app = express();

// ===== Dates de référence =====
const unJour = 1000 * 60 * 60 * 24;
const premierDecembre = new Date(calendrierAvent.annee, 11, 1);

// ===== Simulation de date (null = vraie date) =====
// Exemple de test : new Date(calendrierAvent.annee, 11, 7, 10, 0) pour le 7 décembre à 10 h
const dateSimulee = new Date(calendrierAvent.annee, 11, 7, 10, 0);
const decalage = dateSimulee === null ? 0 : dateSimulee - Date.now();

function maintenant() {
    return new Date(Date.now() + decalage);
}

// ===== Calculs =====
function dernierJourOuvrable(dateCalcule) {
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

app.get("/api/calendrier", (requete, reponse) => {
    reponse.json({
        annee: calendrierAvent.annee,
        date: maintenant()
    });
});

app.get("/api/cadeaux/:jour", (requete, reponse) => {
    const jour = Number(requete.params.jour);

    if (!Number.isInteger(jour) || jour < 1 || jour > 24) {
        return reponse.status(400).json({ erreur: "Jour invalide" });
    }

    if (jour > dernierJourOuvrable(maintenant())) {
        return reponse.status(403).json({ erreur: "Ce jour n'est pas encore arrivé" });
    }

    const cadeau = calendrierAvent.cadeaux.find((c) => c.jour === jour);
    if (cadeau === undefined) {
        return reponse.status(404).json({ erreur: "Aucun cadeau pour ce jour" });
    }

    reponse.json(cadeau);
});

// ===== Fichiers du site =====
app.use(express.static("public"));

// ===== Démarrage =====
app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});