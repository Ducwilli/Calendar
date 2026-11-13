import multer from "multer";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { genererCode } from "./db.js";
import { cheminUploads } from "./chemins.js";

export const tailleMaxImage = 5 * 1024 * 1024;    // 5 Mo
export const tailleMaxVideo = 30 * 1024 * 1024;   // 30 Mo

// Liste blanche : type accepté → extension choisie par le serveur
const extensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm"
};

// Un champ fichier par jour : media-1 à media-24, un fichier au plus chacun
const champsMedias = [];
for (let jour = 1; jour <= 24; jour++) {
    champsMedias.push({ name: `media-${jour}`, maxCount: 1 });
}

const stockage = multer.diskStorage({
    destination: cheminUploads,
    filename: (requete, fichier, rappel) => {
        rappel(null, genererCode() + extensions[fichier.mimetype]);
    }
});

function filtrerType(requete, fichier, rappel) {
    if (extensions[fichier.mimetype] === undefined) {
        const erreur = new Error(
            `Le fichier « ${fichier.originalname} » n'est pas accepté : utilise une photo (JPEG, PNG, WebP, GIF) ou une vidéo (MP4, WebM).`
        );
        erreur.refusee = true;
        return rappel(erreur);
    }
    rappel(null, true);
}

const multerMedias = multer({
    storage: stockage,
    fileFilter: filtrerType,
    limits: {
        fileSize: tailleMaxVideo,   // aucun fichier au-delà de 30 Mo
        files: 24,
        fields: 100,
        fieldSize: 10 * 1024        // 10 Ko par champ texte
    }
}).fields(champsMedias);

// Reçoit les fichiers, et transforme les erreurs de Multer en réponses claires
export function recevoirMedias(requete, reponse, suivant) {
    multerMedias(requete, reponse, (erreur) => {
        if (!erreur) {
            return suivant();
        }

        if (erreur instanceof multer.MulterError) {
            const messages = {
                LIMIT_FILE_SIZE: "Un fichier est trop lourd (30 Mo maximum).",
                LIMIT_FILE_COUNT: "Trop de fichiers envoyés.",
                LIMIT_UNEXPECTED_FILE: "Un fichier a été envoyé dans un champ inattendu."
            };
            return reponse.status(400).json({ erreur: messages[erreur.code] ?? "Envoi des fichiers invalide." });
        }

        if (erreur.refusee) {
            return reponse.status(400).json({ erreur: erreur.message });
        }

        console.error("Erreur lors de la réception des fichiers :", erreur);
        reponse.status(500).json({ erreur: "Impossible de recevoir les fichiers, réessaie plus tard" });
    });
}

// Supprime tous les fichiers reçus dans une requête (quand elle est refusée ou échoue)
export async function supprimerFichiers(fichiers) {
    if (!fichiers) {
        return;
    }
    const liste = Object.values(fichiers).flat();
    await Promise.allSettled(liste.map((fichier) => unlink(fichier.path)));
}

// Supprime du disque des médias enregistrés, à partir de leurs liens (/media/xxx.jpg).
// Les liens qui ne sont pas dans /media/ (par exemple /assets/...) ne sont jamais touchés.
export async function supprimerMedias(liens) {
    const chemins = liens
        .filter((lien) => typeof lien === "string" && lien.startsWith("/media/"))
        .map((lien) => join(cheminUploads, basename(lien)));
    await Promise.allSettled(chemins.map((chemin) => unlink(chemin)));
}
