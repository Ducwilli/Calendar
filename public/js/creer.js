// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-creation");
const champAnnee = document.getElementById("annee");
const listeCadeaux = document.getElementById("liste-cadeaux");
const messageErreur = document.getElementById("message-erreur");
const sectionResultat = document.getElementById("resultat");
const lienPartage = document.getElementById("lien-partage");
const boutonCreer = formulaire.querySelector("button[type='submit']");

// ===== Limites (les mêmes que celles du serveur) =====
const longueurMax = 1000;
const longueurMaxAlt = 300;
const tailleMaxImage = 5 * 1024 * 1024;
const tailleMaxVideo = 30 * 1024 * 1024;
const typesAcceptes = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

// ===== Année pré-remplie =====
champAnnee.value = new Date().getFullYear();

// ===== Les 24 groupes de champs =====
function creerLabel(idChamp, texte) {
    const label = document.createElement("label");
    label.htmlFor = idChamp;
    label.textContent = texte;
    return label;
}

const jours = [];

for (let jour = 1; jour <= 24; jour++) {
    const groupe = document.createElement("fieldset");
    const legende = document.createElement("legend");
    legende.textContent = `Jour ${jour}`;

    const champTexte = document.createElement("textarea");
    champTexte.id = `texte-jour-${jour}`;
    champTexte.maxLength = longueurMax;
    champTexte.rows = 2;

    const champMedia = document.createElement("input");
    champMedia.type = "file";
    champMedia.id = `media-jour-${jour}`;
    champMedia.accept = typesAcceptes;

    const champAlt = document.createElement("input");
    champAlt.type = "text";
    champAlt.id = `alt-jour-${jour}`;
    champAlt.maxLength = longueurMaxAlt;

    groupe.append(
        legende,
        creerLabel(champTexte.id, "Message"),
        champTexte,
        creerLabel(champMedia.id, "Photo ou vidéo (facultatif)"),
        champMedia,
        creerLabel(champAlt.id, "Description de la photo (obligatoire si tu ajoutes une photo)"),
        champAlt
    );
    listeCadeaux.appendChild(groupe);

    jours.push({ jour, champTexte, champMedia, champAlt });
}

// ===== Préparation des données, avec vérifications =====
// Renvoie le FormData à envoyer, ou null après avoir affiché une erreur
function preparerEnvoi() {
    const donnees = new FormData();
    donnees.append("annee", champAnnee.value);

    let nombreCadeaux = 0;

    for (const { jour, champTexte, champMedia, champAlt } of jours) {
        const texte = champTexte.value.trim();
        const fichier = champMedia.files[0];
        const alt = champAlt.value.trim();

        if (texte === "" && fichier === undefined) {
            continue;
        }

        if (fichier !== undefined) {
            const estImage = fichier.type.startsWith("image/");

            if (estImage && fichier.size > tailleMaxImage) {
                messageErreur.textContent = `La photo du jour ${jour} dépasse 5 Mo.`;
                return null;
            }
            if (!estImage && fichier.size > tailleMaxVideo) {
                messageErreur.textContent = `La vidéo du jour ${jour} dépasse 30 Mo.`;
                return null;
            }
            if (estImage && alt === "") {
                messageErreur.textContent = `Décris la photo du jour ${jour} en quelques mots.`;
                champAlt.focus();
                return null;
            }

            donnees.append(`alt-${jour}`, alt);
            donnees.append(`media-${jour}`, fichier);
        }

        donnees.append(`texte-${jour}`, texte);
        nombreCadeaux++;
    }

    if (nombreCadeaux === 0) {
        messageErreur.textContent = "Ajoute au moins un cadeau avant de créer ton calendrier.";
        return null;
    }

    return donnees;
}

// ===== Envoi du formulaire =====
formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";

    const donnees = preparerEnvoi();
    if (donnees === null) {
        return;
    }

    boutonCreer.disabled = true;
    boutonCreer.textContent = "Envoi en cours…";

    let reponse;
    try {
        // Pas d'en-tête Content-Type : le navigateur l'écrit lui-même pour un FormData
        reponse = await fetch("/api/calendriers", { method: "POST", body: donnees });
    } catch {
        messageErreur.textContent = "Impossible de joindre le serveur. Vérifie ta connexion.";
        return;
    } finally {
        boutonCreer.disabled = false;
        boutonCreer.textContent = "Créer mon calendrier";
    }

    if (!reponse.ok) {
        const probleme = await reponse.json();
        messageErreur.textContent = probleme.erreur;
        return;
    }

    const { codePartage } = await reponse.json();
    const adresse = `${location.origin}/c/${codePartage}`;

    const lien = document.createElement("a");
    lien.href = adresse;
    lien.textContent = adresse;
    lienPartage.replaceChildren(lien);

    formulaire.hidden = true;
    sectionResultat.hidden = false;
});