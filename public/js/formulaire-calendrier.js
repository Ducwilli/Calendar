// ===== Module partagé : le formulaire des 24 cadeaux =====
// Utilisé par la page de création (creer.js) et la page de modification (modifier.js)

// Limites (les mêmes que celles du serveur)
const longueurMax = 1000;
const longueurMaxAlt = 300;
const tailleMaxImage = 5 * 1024 * 1024;
const tailleMaxVideo = 30 * 1024 * 1024;
const typesAcceptes = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

function creerLabel(idChamp, texte) {
    const label = document.createElement("label");
    label.htmlFor = idChamp;
    label.textContent = texte;
    return label;
}

// Construit les 24 groupes de champs dans le conteneur, et renvoie la liste des jours
export function construireChampsCadeaux(conteneur) {
    const jours = [];

    for (let jour = 1; jour <= 24; jour++) {
        const groupe = document.createElement("fieldset");
        const legende = document.createElement("legend");
        legende.textContent = `Jour ${jour}`;

        const champTexte = document.createElement("textarea");
        champTexte.id = `texte-jour-${jour}`;
        champTexte.maxLength = longueurMax;
        champTexte.rows = 2;

        // Média déjà enregistré (page de modification uniquement) : caché par défaut
        const zoneMediaActuel = document.createElement("div");
        zoneMediaActuel.className = "media-actuel";
        zoneMediaActuel.hidden = true;

        const apercu = document.createElement("div");
        apercu.className = "apercu";

        const caseSupprimer = document.createElement("input");
        caseSupprimer.type = "checkbox";
        caseSupprimer.id = `supprimer-media-jour-${jour}`;

        const labelSupprimer = creerLabel(caseSupprimer.id, "Supprimer ce média");
        labelSupprimer.prepend(caseSupprimer);

        const aide = document.createElement("p");
        aide.textContent = "Pour le remplacer, choisis simplement un nouveau fichier ci-dessous.";

        zoneMediaActuel.append(apercu, labelSupprimer, aide);

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
            zoneMediaActuel,
            creerLabel(champMedia.id, "Photo ou vidéo (facultatif)"),
            champMedia,
            creerLabel(champAlt.id, "Description de la photo (obligatoire pour une photo)"),
            champAlt
        );
        conteneur.appendChild(groupe);

        jours.push({
            jour,
            champTexte,
            champMedia,
            champAlt,
            zoneMediaActuel,
            apercu,
            caseSupprimer,
            mediaActuel: null   // { typeMedia, lienMedia } si un média est déjà enregistré
        });
    }

    return jours;
}

// Remplit les champs avec les cadeaux existants (page de modification)
export function preRemplirChamps(jours, cadeaux) {
    for (const jourCourant of jours) {
        const cadeau = cadeaux.find((c) => c.jour === jourCourant.jour);

        jourCourant.champTexte.value = cadeau?.texte ?? "";
        jourCourant.champAlt.value = cadeau?.texteAlt ?? "";
        jourCourant.champMedia.value = "";
        jourCourant.caseSupprimer.checked = false;
        jourCourant.apercu.replaceChildren();

        if (cadeau?.lienMedia) {
            jourCourant.mediaActuel = { typeMedia: cadeau.typeMedia, lienMedia: cadeau.lienMedia };

            const element = document.createElement(cadeau.typeMedia === "image" ? "img" : "video");
            element.src = cadeau.lienMedia;
            if (cadeau.typeMedia === "image") {
                element.alt = cadeau.texteAlt ?? "";
            } else {
                element.controls = true;
            }
            jourCourant.apercu.appendChild(element);
            jourCourant.zoneMediaActuel.hidden = false;
        } else {
            jourCourant.mediaActuel = null;
            jourCourant.zoneMediaActuel.hidden = true;
        }
    }
}

// Prépare le FormData à envoyer, ou renvoie null après avoir affiché une erreur
export function preparerFormData(champAnnee, jours, messageErreur) {
    const donnees = new FormData();
    donnees.append("annee", champAnnee.value);

    let nombreCadeaux = 0;

    for (const jourCourant of jours) {
        const { jour, champTexte, champMedia, champAlt, caseSupprimer, mediaActuel } = jourCourant;
        const texte = champTexte.value.trim();
        const fichier = champMedia.files[0];
        const alt = champAlt.value.trim();

        // Le média final du jour : un nouveau fichier, sinon l'actuel s'il est gardé
        const garderActuel = mediaActuel !== null && !caseSupprimer.checked && fichier === undefined;
        let estImage = false;

        if (fichier !== undefined) {
            estImage = fichier.type.startsWith("image/");
            if (estImage && fichier.size > tailleMaxImage) {
                messageErreur.textContent = `La photo du jour ${jour} dépasse 5 Mo.`;
                return null;
            }
            if (!estImage && fichier.size > tailleMaxVideo) {
                messageErreur.textContent = `La vidéo du jour ${jour} dépasse 30 Mo.`;
                return null;
            }
        } else if (garderActuel) {
            estImage = mediaActuel.typeMedia === "image";
        }

        const aUnMedia = fichier !== undefined || garderActuel;

        if (texte === "" && !aUnMedia) {
            continue;
        }

        if (estImage && alt === "") {
            messageErreur.textContent = `Décris la photo du jour ${jour} en quelques mots.`;
            champAlt.focus();
            return null;
        }

        donnees.append(`texte-${jour}`, texte);
        donnees.append(`alt-${jour}`, alt);
        if (fichier !== undefined) {
            donnees.append(`media-${jour}`, fichier);
        }
        if (mediaActuel !== null && caseSupprimer.checked) {
            donnees.append(`choix-media-${jour}`, "supprimer");
        }
        nombreCadeaux++;
    }

    if (nombreCadeaux === 0) {
        messageErreur.textContent = "Ajoute au moins un cadeau à ton calendrier.";
        return null;
    }

    return donnees;
}
