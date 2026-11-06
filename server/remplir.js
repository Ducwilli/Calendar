import { db } from "./db.js";
import { calendrierAvent } from "./donnees.js";

// 1. Vider les tables (les cadeaux d'abord, à cause de la clé étrangère)
db.exec("DELETE FROM cadeaux;");
db.exec("DELETE FROM calendriers;");

// 2. Insérer le calendrier et récupérer son id
const resultat = db
    .prepare("INSERT INTO calendriers (annee) VALUES (?)")
    .run(calendrierAvent.annee);
const calendrierId = resultat.lastInsertRowid;

// 3. Préparer l'insertion des cadeaux une seule fois
const insererCadeau = db.prepare(`
    INSERT INTO cadeaux (calendrier_id, jour, texte, type_media, lien_media, texte_alt)
    VALUES (?, ?, ?, ?, ?, ?)
`);

// 4. Insérer chaque cadeau
for (const cadeau of calendrierAvent.cadeaux) {
    insererCadeau.run(
        calendrierId,
        cadeau.jour,
        cadeau.texte,
        cadeau.typeMedia,
        cadeau.lienMedia,
        cadeau.texteAlt
    );
}

console.log(`Calendrier ${calendrierAvent.annee} créé (id ${calendrierId}) avec ${calendrierAvent.cadeaux.length} cadeaux.`);