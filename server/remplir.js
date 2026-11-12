import { db, genererCode } from "./db.js";
import { hacherMotDePasse } from "./motsDePasse.js";
import { calendrierAvent } from "./donnees.js";

const emailTest = "admin@gmail.fr";
const motDePasseTest = "calendrier-test-2026";

// 1. Vider la base : les cascades suppriment calendriers, cadeaux et sessions
db.exec("DELETE FROM utilisateurs;");

// 2. Créer l'utilisateur de test
const { sel, empreinte } = await hacherMotDePasse(motDePasseTest);
const utilisateur = db
    .prepare("INSERT INTO utilisateurs (mail, mot_de_passe_hache, sel) VALUES (?, ?, ?)")
    .run(emailTest, empreinte, sel);

// 3. Créer le calendrier, avec cet utilisateur comme propriétaire
const codePartage = genererCode();
const calendrier = db
    .prepare("INSERT INTO calendriers (proprietaire_id, annee, code_partage) VALUES (?, ?, ?)")
    .run(utilisateur.lastInsertRowid, calendrierAvent.annee, codePartage);

// 4. Insérer les cadeaux
const insererCadeau = db.prepare(`
    INSERT INTO cadeaux (calendrier_id, jour, texte, type_media, lien_media, texte_alt)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const cadeau of calendrierAvent.cadeaux) {
    insererCadeau.run(
        calendrier.lastInsertRowid,
        cadeau.jour,
        cadeau.texte,
        cadeau.typeMedia,
        cadeau.lienMedia,
        cadeau.texteAlt
    );
}

console.log(`Compte de test : ${emailTest} / ${motDePasseTest}`);
console.log(`Calendrier ${calendrierAvent.annee} créé avec ${calendrierAvent.cadeaux.length} cadeaux :`);
console.log(`http://localhost:3000/c/${codePartage}`);