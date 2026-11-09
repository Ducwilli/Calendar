import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

// Code de partage aléatoire, impossible à deviner (8 caractères)
export function genererCode() {
    return randomBytes(6).toString("base64url");
}

export const db = new DatabaseSync("calendrier.db");
db.exec("PRAGMA foreign_keys = ON;"); 
db.exec(
    `CREATE TABLE IF NOT EXISTS calendriers (
        id INTEGER PRIMARY KEY,
        code_partage TEXT NOT NULL UNIQUE, 
        annee INTEGER NOT NULL CHECK (annee > 2025)
     );

    CREATE TABLE IF NOT EXISTS cadeaux (
        id INTEGER PRIMARY KEY,
        calendrier_id INTEGER NOT NULL REFERENCES calendriers(id),
        jour INTEGER NOT NULL CHECK (jour BETWEEN 1 AND 24),
        texte TEXT,
        type_media TEXT CHECK (type_media IN ('image', 'video') OR type_media IS NULL),
        lien_media TEXT,
        texte_alt TEXT,
        UNIQUE (calendrier_id, jour),
        CHECK (texte IS NOT NULL OR lien_media IS NOT NULL)
    );`
);

