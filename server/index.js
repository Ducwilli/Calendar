import express from "express";
import { resolve } from "node:path";
import { db, genererCode } from "./db.js";
import { recevoirMedias, supprimerFichiers, tailleMaxImage } from "./medias.js";
import { hacherMotDePasse } from "./motsDePasse.js";
import { creerSession, poserCookieSession } from "./sessions.js";

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

const insererUtilisateur = db.prepare(`
    INSERT INTO utilisateurs (mail, mot_de_passe_hache, sel)
    VALUES (?, ?, ?)
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

// ===== Outils de vérification =====
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

// ===== Vérification d'un calendrier envoyé par le navigateur =====
const anneeMin = 2026;
const longueurMax = 1000;
const longueurMaxAlt = 300;

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

// ===== Vérification d'une inscription =====
const longueurMaxEmail = 254;
const longueurMinMotDePasse = 10;
const longueurMaxMotDePasse = 200;
const formatEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Renvoie { erreur } si quelque chose ne va pas, sinon { email, motDePasse } nettoyés
function verifierInscription(donnees) {
    if (!estUnObjet(donnees)) {
        return { erreur: "Données invalides" };
    }

    if (typeof donnees.email !== "string") {
        return { erreur: "L'email est obligatoire" };
    }
    const email = donnees.email.trim().toLowerCase();
    if (email.length > longueurMaxEmail || !formatEmail.test(email)) {
        return { erreur: "Cet email n'est pas valide" };
    }

    // Pas de trim : les espaces font partie du mot de passe
    const motDePasse = donnees.motDePasse;
    if (typeof motDePasse !== "string") {
        return { erreur: "Le mot de passe est obligatoire" };
    }
    if (motDePasse.length < longueurMinMotDePasse || motDePasse.length > longueurMaxMotDePasse) {
        return { erreur: `Le mot de passe doit contenir entre ${longueurMinMotDePasse} et ${longueurMaxMotDePasse} caractères` };
    }

    return { email, motDePasse };
}

// ===== Routes de l'API : calendriers =====
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

// ===== Routes de l'API : comptes =====
app.post("/api/inscription", async (requete, reponse) => {
    // 1. Vérifier l'email et le mot de passe
    const resultat = verifierInscription(requete.body);
    if (resultat.erreur) {
        return reponse.status(400).json({ erreur: resultat.erreur });
    }

    // 2. Créer le compte (le mot de passe n'est jamais stocké)
    const { sel, empreinte } = await hacherMotDePasse(resultat.motDePasse);

    let utilisateurId;
    try {
        const insertion = insererUtilisateur.run(resultat.email, empreinte, sel);
        utilisateurId = insertion.lastInsertRowid;
    } catch (erreur) {
        if (String(erreur.message).includes("UNIQUE")) {
            return reponse.status(409).json({ erreur: "Un compte existe déjà avec cet email" });
        }
        console.error("Échec de l'inscription :", erreur);
        return reponse.status(500).json({ erreur: "Impossible de créer le compte, réessaie plus tard" });
    }

    // 3. Connecter directement le nouvel utilisateur
    const jeton = creerSession(utilisateurId);
    poserCookieSession(reponse, jeton);

    reponse.status(201).json({ email: resultat.email });
});

// ===== Pages =====
app.get("/", (requete, reponse) => {
    reponse.sendFile(resolve("public/accueil.html"));
});

app.get("/creer", (requete, reponse) => {
    reponse.sendFile(resolve("public/creer.html"));
});

app.get("/inscription", (requete, reponse) => {
    reponse.sendFile(resolve("public/inscription.html"));
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