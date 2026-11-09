import { db, genererCode } from "./db.js";
import { calendrierAvent } from "./donnees.js";

// 1. Vider les tables (les cadeaux d'abord, à cause de la clé étrangère)
db.exec("DELETE FROM cadeaux;");
db.exec("DELETE FROM calendriers;");

// 2. Insérer le calendrier et creer son code de partage
const codePartage = genererCode();
const resultat = db
    .prepare("INSERT INTO calendriers (annee, code_partage) VALUES (?, ?)")
    .run(calendrierAvent.annee, codePartage);
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

console.log(`Calendrier ${calendrierAvent.annee} créé (http://localhost:3000/c/${codePartage}) avec ${calendrierAvent.cadeaux.length} cadeaux.`);