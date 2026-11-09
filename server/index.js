import express from "express";
import { resolve } from "node:path";
import { db, genererCode } from "./db.js";
import { recevoirMedias, supprimerFichiers, tailleMaxImage } from "./medias.js";

const app = express();
app.use(express.json());

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

const insererCalendrier = db.prepare(`
    INSERT INTO calendriers (annee, code_partage)
    VALUES (?, ?)
`);

const insererCadeau = db.prepare(`
    INSERT INTO cadeaux (calendrier_id, jour, texte, type_media, lien_media, texte_alt)
    VALUES (?, ?, ?, ?, ?, ?)
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

// ===== Vérification d'un calendrier envoyé par le navigateur =====
const anneeMin = 2026;
const longueurMax = 1000;
const longueurMaxAlt = 300;

function estUnObjet(valeur) {
    return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

// Lit un champ texte du formulaire : "" s'il est absent, null s'il est invalide
function lireChamp(champs, nom) {
    const valeur = champs[nom];
    if (valeur === undefined) {
        return "";
    }
    if (typeof valeur !== "string") {
        return null;   // par exemple un champ envoyé deux fois
    }
    return valeur.trim();
}

// Renvoie { erreur } si quelque chose ne va pas, sinon { annee, cadeaux } nettoyés
function verifierCalendrier(champs, fichiers) {
    if (!estUnObjet(champs)) {
        return { erreur: "Données invalides" };
    }

    const annee = Number(lireChamp(champs, "annee"));
    if (!Number.isInteger(annee) || annee < anneeMin) {
        return { erreur: `L'année doit être un nombre entier, au moins ${anneeMin}` };
    }

    const cadeaux = [];

    for (let jour = 1; jour <= 24; jour++) {
        const texte = lireChamp(champs, `texte-${jour}`);
        const alt = lireChamp(champs, `alt-${jour}`);
        if (texte === null || alt === null) {
            return { erreur: `Les champs du jour ${jour} sont invalides` };
        }

        const fichier = fichiers?.[`media-${jour}`]?.[0];

        // Jour laissé vide : pas de cadeau
        if (texte === "" && fichier === undefined) {
            continue;
        }

        if (texte.length > longueurMax) {
            return { erreur: `Le texte du jour ${jour} dépasse ${longueurMax} caractères` };
        }

        let typeMedia = null;
        let lienMedia = null;
        let texteAlt = null;

        if (fichier !== undefined) {
            typeMedia = fichier.mimetype.startsWith("image/") ? "image" : "video";
            lienMedia = `/media/${fichier.filename}`;

            if (typeMedia === "image") {
                if (fichier.size > tailleMaxImage) {
                    return { erreur: `La photo du jour ${jour} dépasse 5 Mo` };
                }
                if (alt === "") {
                    return { erreur: `Décris la photo du jour ${jour} en quelques mots` };
                }
                if (alt.length > longueurMaxAlt) {
                    return { erreur: `La description de la photo du jour ${jour} dépasse ${longueurMaxAlt} caractères` };
                }
                texteAlt = alt;
            }
        }

        cadeaux.push({
            jour,
            texte: texte === "" ? null : texte,
            typeMedia,
            lienMedia,
            texteAlt
        });
    }

    if (cadeaux.length === 0) {
        return { erreur: "Le calendrier doit contenir au moins un cadeau" };
    }

    return { annee, cadeaux };
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

app.post("/api/calendriers", recevoirMedias, async (requete, reponse) => {
    // 1. Vérifier tout ce qui arrive (textes et fichiers)
    const resultat = verifierCalendrier(requete.body, requete.files);
    if (resultat.erreur) {
        await supprimerFichiers(requete.files);
        return reponse.status(400).json({ erreur: resultat.erreur });
    }

    // 2. Tout enregistrer, ou rien
    const codePartage = genererCode();
    db.exec("BEGIN");
    try {
        const insertion = insererCalendrier.run(resultat.annee, codePartage);
        const calendrierId = insertion.lastInsertRowid;

        for (const cadeau of resultat.cadeaux) {
            insererCadeau.run(
                calendrierId,
                cadeau.jour,
                cadeau.texte,
                cadeau.typeMedia,
                cadeau.lienMedia,
                cadeau.texteAlt
            );
        }

        db.exec("COMMIT");
    } catch (erreur) {
        db.exec("ROLLBACK");
        await supprimerFichiers(requete.files);
        console.error("Échec de la création d'un calendrier :", erreur);
        return reponse.status(500).json({ erreur: "Impossible de créer le calendrier, réessaie plus tard" });
    }

    // 3. Renvoyer le code de partage
    reponse.status(201).json({ codePartage });
});

// ===== Pages =====
app.get("/", (requete, reponse) => {
    reponse.sendFile(resolve("public/accueil.html"));
});

app.get("/creer", (requete, reponse) => {
    reponse.sendFile(resolve("public/creer.html"));
});

app.get("/c/:code", (requete, reponse) => {
    const calendrier = lireCalendrier.get(requete.params.code);
    if (calendrier === undefined) {
        return reponse.status(404).send("Ce calendrier n'existe pas. Vérifie le lien qu'on t'a envoyé.");
    }

    reponse.sendFile(resolve("public/index.html"));
});

// ===== Fichiers =====
app.use("/media", express.static("uploads"));
app.use(express.static("public"));

// ===== Démarrage =====
app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});