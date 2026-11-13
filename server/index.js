import express from "express";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { db, genererCode } from "./db.js";
import { recevoirMedias, supprimerFichiers, supprimerMedias, tailleMaxImage } from "./medias.js";
import { hacherMotDePasse, verifierMotDePasse } from "./motsDePasse.js";
import {
    creerSession,
    supprimerSession,
    poserCookieSession,
    effacerCookieSession,
    identifierUtilisateur,
    exigerConnexion,
    nettoyerSessionsExpirees
} from "./sessions.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(identifierUtilisateur);

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
    INSERT INTO calendriers (proprietaire_id, annee, code_partage)
    VALUES (?, ?, ?)
`);

const lireCalendrierAvecProprietaire = db.prepare(`
    SELECT id, annee, proprietaire_id AS proprietaireId
    FROM calendriers
    WHERE code_partage = ?
`);

const lireTousLesCadeaux = db.prepare(`
    SELECT jour,
           texte,
           type_media AS typeMedia,
           lien_media AS lienMedia,
           texte_alt AS texteAlt
    FROM cadeaux
    WHERE calendrier_id = ?
    ORDER BY jour
`);

const modifierAnnee = db.prepare(`
    UPDATE calendriers
    SET annee = ?
    WHERE id = ?
`);

const supprimerCadeauxDuCalendrier = db.prepare(`
    DELETE FROM cadeaux
    WHERE calendrier_id = ?
`);

const lireMesCalendriers = db.prepare(`
    SELECT code_partage AS codePartage,
           annee,
           (SELECT COUNT(*) FROM cadeaux WHERE calendrier_id = calendriers.id) AS nombreCadeaux
    FROM calendriers
    WHERE proprietaire_id = ?
    ORDER BY annee DESC, id DESC
`);

const insererCadeau = db.prepare(`
    INSERT INTO cadeaux (calendrier_id, jour, texte, type_media, lien_media, texte_alt)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insererUtilisateur = db.prepare(`
    INSERT INTO utilisateurs (mail, mot_de_passe_hache, sel)
    VALUES (?, ?, ?)
`);

const lireUtilisateurParEmail = db.prepare(`
    SELECT id,
           mot_de_passe_hache AS empreinte,
           sel
    FROM utilisateurs
    WHERE mail = ?
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

// Renvoie { erreur } si quelque chose ne va pas, sinon { annee, cadeaux } nettoyés.
// mediasExistants : pour une modification, les médias déjà enregistrés, par jour
// (une Map jour → { typeMedia, lienMedia }). Vide pour une création.
function verifierCalendrier(champs, fichiers, mediasExistants = new Map()) {
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
        const choixMedia = lireChamp(champs, `choix-media-${jour}`);
        if (texte === null || alt === null || (choixMedia !== "" && choixMedia !== "supprimer")) {
            return { erreur: `Les champs du jour ${jour} sont invalides` };
        }

        const fichier = fichiers?.[`media-${jour}`]?.[0];

        // Média déjà enregistré, gardé s'il n'est ni remplacé ni supprimé
        const mediaExistant = mediasExistants.get(jour);
        const mediaGarde = fichier === undefined && choixMedia !== "supprimer" ? mediaExistant : undefined;

        // Jour laissé vide : pas de cadeau
        if (texte === "" && fichier === undefined && mediaGarde === undefined) {
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

            if (typeMedia === "image" && fichier.size > tailleMaxImage) {
                return { erreur: `La photo du jour ${jour} dépasse 5 Mo` };
            }
        } else if (mediaGarde !== undefined) {
            typeMedia = mediaGarde.typeMedia;
            lienMedia = mediaGarde.lienMedia;
        }

        if (typeMedia === "image") {
            if (alt === "") {
                return { erreur: `Décris la photo du jour ${jour} en quelques mots` };
            }
            if (alt.length > longueurMaxAlt) {
                return { erreur: `La description de la photo du jour ${jour} dépasse ${longueurMaxAlt} caractères` };
            }
            texteAlt = alt;
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

// ===== Vérification d'une connexion =====
// Empreinte factice : utilisée quand l'email est inconnu, pour que la réponse
// prenne le même temps que pour un email connu
const empreinteFactice = await hacherMotDePasse("mot-de-passe-factice-pour-egaliser-le-temps");

// Renvoie { email, motDePasse } nettoyés, ou null si la forme est invalide
function lireIdentifiants(donnees) {
    if (!estUnObjet(donnees)) {
        return null;
    }
    if (typeof donnees.email !== "string" || typeof donnees.motDePasse !== "string") {
        return null;
    }

    const email = donnees.email.trim().toLowerCase();
    const motDePasse = donnees.motDePasse;
    if (email.length > longueurMaxEmail || motDePasse.length > longueurMaxMotDePasse) {
        return null;
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

app.post("/api/calendriers", exigerConnexion, recevoirMedias, async (requete, reponse) => {
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
        const insertion = insererCalendrier.run(requete.utilisateur.id, resultat.annee, codePartage);
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

// ===== Autorisation : le calendrier appartient-il à l'utilisateur connecté ? =====
// Renvoie le calendrier, ou null après avoir répondu 404 ou 403
function calendrierDuProprietaire(requete, reponse) {
    const calendrier = lireCalendrierAvecProprietaire.get(requete.params.code);
    if (calendrier === undefined) {
        reponse.status(404).json({ erreur: "Calendrier introuvable" });
        return null;
    }
    if (calendrier.proprietaireId !== requete.utilisateur.id) {
        reponse.status(403).json({ erreur: "Ce calendrier ne t'appartient pas" });
        return null;
    }
    return calendrier;
}

// Lecture complète, réservée au propriétaire : tous les cadeaux, même les jours futurs
app.get("/api/calendriers/:code/edition", exigerConnexion, (requete, reponse) => {
    const calendrier = calendrierDuProprietaire(requete, reponse);
    if (calendrier === null) {
        return;
    }

    reponse.json({
        annee: calendrier.annee,
        cadeaux: lireTousLesCadeaux.all(calendrier.id)
    });
});

// Modification, réservée au propriétaire : remplace l'année et tous les cadeaux
app.put("/api/calendriers/:code", exigerConnexion, recevoirMedias, async (requete, reponse) => {
    // 1. Autorisation (les fichiers déjà reçus sont supprimés en cas de refus)
    const calendrier = calendrierDuProprietaire(requete, reponse);
    if (calendrier === null) {
        await supprimerFichiers(requete.files);
        return;
    }

    // 2. Les médias actuels, par jour
    const anciensCadeaux = lireTousLesCadeaux.all(calendrier.id);
    const mediasExistants = new Map();
    for (const cadeau of anciensCadeaux) {
        if (cadeau.lienMedia !== null) {
            mediasExistants.set(cadeau.jour, { typeMedia: cadeau.typeMedia, lienMedia: cadeau.lienMedia });
        }
    }

    // 3. Vérifier tout ce qui arrive
    const resultat = verifierCalendrier(requete.body, requete.files, mediasExistants);
    if (resultat.erreur) {
        await supprimerFichiers(requete.files);
        return reponse.status(400).json({ erreur: resultat.erreur });
    }

    // 4. Tout remplacer, ou rien
    db.exec("BEGIN");
    try {
        modifierAnnee.run(resultat.annee, calendrier.id);
        supprimerCadeauxDuCalendrier.run(calendrier.id);
        for (const cadeau of resultat.cadeaux) {
            insererCadeau.run(
                calendrier.id,
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
        console.error("Échec de la modification d'un calendrier :", erreur);
        return reponse.status(500).json({ erreur: "Impossible d'enregistrer les modifications, réessaie plus tard" });
    }

    // 5. Seulement maintenant : supprimer du disque les médias qui ne servent plus
    const liensConserves = new Set(resultat.cadeaux.map((cadeau) => cadeau.lienMedia));
    const liensAbandonnes = anciensCadeaux
        .map((cadeau) => cadeau.lienMedia)
        .filter((lien) => lien !== null && !liensConserves.has(lien));
    await supprimerMedias(liensAbandonnes);

    reponse.json({ message: "Calendrier modifié" });
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

app.post("/api/connexion", async (requete, reponse) => {
    // 1. Vérifier la forme
    const identifiants = lireIdentifiants(requete.body);
    if (identifiants === null) {
        return reponse.status(400).json({ erreur: "L'email et le mot de passe sont obligatoires" });
    }

    // 2. Retrouver l'utilisateur, et vérifier le mot de passe dans tous les cas
    const utilisateur = lireUtilisateurParEmail.get(identifiants.email);
    const sel = utilisateur?.sel ?? empreinteFactice.sel;
    const empreinte = utilisateur?.empreinte ?? empreinteFactice.empreinte;
    const motDePasseCorrect = await verifierMotDePasse(identifiants.motDePasse, sel, empreinte);

    // 3. Même réponse pour un email inconnu et un mauvais mot de passe
    if (utilisateur === undefined || !motDePasseCorrect) {
        return reponse.status(401).json({ erreur: "Email ou mot de passe incorrect" });
    }

    // 4. Ouvrir la session
    const jeton = creerSession(utilisateur.id);
    poserCookieSession(reponse, jeton);

    reponse.json({ email: identifiants.email });
});

app.post("/api/deconnexion", (requete, reponse) => {
    const jeton = requete.cookies.session;
    if (typeof jeton === "string") {
        supprimerSession(jeton);
    }

    effacerCookieSession(reponse);
    reponse.status(204).end();
});

app.get("/api/moi", exigerConnexion, (requete, reponse) => {
    reponse.json({ email: requete.utilisateur.email });
});

app.get("/api/mes-calendriers", exigerConnexion, (requete, reponse) => {
    const calendriers = lireMesCalendriers.all(requete.utilisateur.id);
    reponse.json(calendriers);
});

// ===== Pages =====
app.get("/", (requete, reponse) => {
    reponse.sendFile(resolve("public/accueil.html"));
});

app.get("/creer", (requete, reponse) => {
    if (requete.utilisateur === null) {
        return reponse.redirect("/connexion");
    }
    reponse.sendFile(resolve("public/creer.html"));
});

app.get("/modifier/:code", (requete, reponse) => {
    if (requete.utilisateur === null) {
        return reponse.redirect("/connexion");
    }

    const calendrier = lireCalendrierAvecProprietaire.get(requete.params.code);
    if (calendrier === undefined) {
        return reponse.status(404).send("Ce calendrier n'existe pas.");
    }
    if (calendrier.proprietaireId !== requete.utilisateur.id) {
        return reponse.status(403).send("Ce calendrier ne t'appartient pas.");
    }

    reponse.sendFile(resolve("public/modifier.html"));
});

app.get("/mes-calendriers", (requete, reponse) => {
    if (requete.utilisateur === null) {
        return reponse.redirect("/connexion");
    }
    reponse.sendFile(resolve("public/mes-calendriers.html"));
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

app.get("/connexion", (requete, reponse) => {
    reponse.sendFile(resolve("public/connexion.html"));
});

// ===== Fichiers =====
app.use("/media", express.static("uploads"));
app.use(express.static("public"));

// ===== Nettoyage des sessions expirées : au démarrage, puis une fois par jour =====
nettoyerSessionsExpirees();
setInterval(nettoyerSessionsExpirees, unJour);

// ===== Démarrage =====
app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});