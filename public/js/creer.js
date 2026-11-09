// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-creation");
const champAnnee = document.getElementById("annee");
const listeCadeaux = document.getElementById("liste-cadeaux");
const messageErreur = document.getElementById("message-erreur");
const sectionResultat = document.getElementById("resultat");
const lienPartage = document.getElementById("lien-partage");

const longueurMax = 1000;

// ===== Année pré-remplie =====
champAnnee.value = new Date().getFullYear();

// ===== Les 24 champs, gardés dans un tableau =====
const champsTexte = [];

for (let jour = 1; jour <= 24; jour++) {
    const label = document.createElement("label");
    label.htmlFor = `texte-jour-${jour}`;
    label.textContent = `Jour ${jour}`;

    const champ = document.createElement("textarea");
    champ.id = `texte-jour-${jour}`;
    champ.maxLength = longueurMax;
    champ.rows = 2;

    listeCadeaux.appendChild(label);
    listeCadeaux.appendChild(champ);
    champsTexte.push(champ);
}

// ===== Envoi du formulaire =====
formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";

    const cadeaux = [];
    champsTexte.forEach((champ, position) => {
        const texte = champ.value.trim();
        if (texte !== "") {
            cadeaux.push({ jour: position + 1, texte: texte });
        }
    });

    if (cadeaux.length === 0) {
        messageErreur.textContent = "Ajoute au moins un cadeau avant de créer ton calendrier.";
        return;
    }

    const donnees = {
        annee: Number(champAnnee.value),
        cadeaux: cadeaux
    };

    // Pour l'instant : on affiche ce qui serait envoyé au serveur (morceau D)
    console.log(donnees);
});