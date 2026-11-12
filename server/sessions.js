import { randomBytes, createHash } from "node:crypto";
import { db } from "./db.js";

// Durée de vie d'une session : 30 jours, en millisecondes
export const dureeSession = 30 * 24 * 60 * 60 * 1000;

const insererSession = db.prepare(`
    INSERT INTO sessions (utilisateur_id, jeton_hache, date_expiration)
    VALUES (?, ?, ?)
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

// Écrit le cookie de session dans la réponse
export function poserCookieSession(reponse, jeton) {
    reponse.cookie("session", jeton, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,          // à passer à true à la mise en ligne (HTTPS)
        maxAge: dureeSession,
        path: "/"
    });
}