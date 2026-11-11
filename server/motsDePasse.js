import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Version de scrypt qui renvoie une promesse (créée une seule fois)
const scryptAsync = promisify(scrypt);

const longueurEmpreinte = 64;   // octets

// À l'inscription : renvoie le sel et l'empreinte, en hexadécimal, prêts à être stockés
export async function hacherMotDePasse(motDePasse) {
    const sel = randomBytes(16).toString("hex");
    const empreinte = await scryptAsync(motDePasse, sel, longueurEmpreinte);
    return { sel, empreinte: empreinte.toString("hex") };
}

// À la connexion : vérifie un mot de passe avec le sel et l'empreinte lus dans la base
export async function verifierMotDePasse(motDePasse, sel, empreinte) {
    const empreinteStockee = Buffer.from(empreinte, "hex");
    const empreinteCalculee = await scryptAsync(motDePasse, sel, longueurEmpreinte);

    if (empreinteStockee.length !== empreinteCalculee.length) {
        return false;
    }
    return timingSafeEqual(empreinteStockee, empreinteCalculee);
}