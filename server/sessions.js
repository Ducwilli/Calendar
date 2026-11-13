import { randomBytes, createHash } from "node:crypto";
import { db } from "./db.js";

// Durée de vie d'une session : 30 jours, en millisecondes
export const dureeSession = 30 * 24 * 60 * 60 * 1000;

// Options communes au cookie : identiques à la création et à l'effacement
const optionsCookie = {
    httpOnly: true,
    sameSite: "lax",
    secure: false,          // à passer à true à la mise en ligne (HTTPS)
    path: "/"
};

const insererSession = db.prepare(`
    INSERT INTO sessions (utilisateur_id, jeton_hache, date_expiration)
    VALUES (?, ?, ?)
`);

const supprimerSessionParJeton = db.prepare(`
    DELETE FROM sessions
    WHERE jeton_hache = ?
`);

const lireSession = db.prepare(`
    SELECT sessions.date_expiration AS expiration,
           utilisateurs.id AS utilisateurId,
           utilisateurs.mail AS email
    FROM sessions
    JOIN utilisateurs ON utilisateurs.id = sessions.utilisateur_id
    WHERE sessions.jeton_hache = ?
`);

const supprimerSessionsExpirees = db.prepare(`
    DELETE FROM sessions
    WHERE date_expiration < ?
`);

// Hachage rapide (SHA-256) : suffisant pour un jeton long et aléatoire
export function hacherJeton(jeton) {
    return createHash("sha256").update(jeton).digest("hex");
}

// Crée une session en base et renvoie le jeton en clair (à mettre dans le cookie)
export function creerSession(utilisateurId) {
    const jeton = randomBytes(32).toString("base64url");
    const expiration = Date.now() + dureeSession;
    insererSession.run(utilisateurId, hacherJeton(jeton), expiration);
    return jeton;
}

// Supprime la session correspondant à un jeton (déconnexion)
export function supprimerSession(jeton) {
    supprimerSessionParJeton.run(hacherJeton(jeton));
}

// Retire de la réponse un cookie de session déjà prévu (par exemple un effacement
// demandé par identifierUtilisateur), pour ne jamais envoyer deux ordres contradictoires
function retirerCookieSessionPrevu(reponse) {
    const entetes = reponse.getHeader("Set-Cookie");
    if (entetes === undefined) {
        return;
    }
    const liste = Array.isArray(entetes) ? entetes : [entetes];
    reponse.setHeader("Set-Cookie", liste.filter((entete) => !entete.startsWith("session=")));
}

// Écrit le cookie de session dans la réponse
export function poserCookieSession(reponse, jeton) {
    retirerCookieSessionPrevu(reponse);
    reponse.cookie("session", jeton, { ...optionsCookie, maxAge: dureeSession });
}

// Demande au navigateur d'effacer le cookie de session
export function effacerCookieSession(reponse) {
    reponse.clearCookie("session", optionsCookie);
}

// Middleware : remplit requete.utilisateur ({ id, email }) ou null
export function identifierUtilisateur(requete, reponse, suivant) {
    requete.utilisateur = null;

    const jeton = requete.cookies?.session;
    if (typeof jeton !== "string") {
        return suivant();
    }

    const jetonHache = hacherJeton(jeton);
    const session = lireSession.get(jetonHache);

    // Jeton inconnu (session supprimée, ou cookie inventé) : on efface le cookie
    if (session === undefined) {
        effacerCookieSession(reponse);
        return suivant();
    }

    // Session expirée : on la supprime et on efface le cookie
    if (session.expiration < Date.now()) {
        supprimerSessionParJeton.run(jetonHache);
        effacerCookieSession(reponse);
        return suivant();
    }

    requete.utilisateur = { id: session.utilisateurId, email: session.email };
    suivant();
}

// Middleware : bloque les routes réservées aux utilisateurs connectés
export function exigerConnexion(requete, reponse, suivant) {
    if (requete.utilisateur === null) {
        return reponse.status(401).json({ erreur: "Tu dois être connecté" });
    }
    suivant();
}

// Supprime de la base toutes les sessions expirées
export function nettoyerSessionsExpirees() {
    supprimerSessionsExpirees.run(Date.now());
}