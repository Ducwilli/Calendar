// ===== Éléments de la page =====
const grille = document.getElementById("grille");
const titreFenetre = document.getElementById("cadeau-titre");
const fenetreCadeau = document.getElementById("fenetre-cadeau");
const texteFenetreCadeau = document.getElementById("cadeau-texte");
const mediaFenetreCadeau = document.getElementById("cadeau-media");
const boutonFermerCadeau = document.getElementById("cadeau-fermer");
const ecranNoel = document.getElementById("ecran-noel");
const ecranAttente = document.getElementById("ecran-attente");
const compteARebours = document.getElementById("compte-a-rebours");
const boutonNonOuverts = document.getElementById("bouton-non-ouverts");

// ===== Informations du serveur =====
const reponseCalendrier = await fetch("/api/calendrier");
const infosCalendrier = await reponseCalendrier.json();

const annee = infosCalendrier.annee;
const dateServeur = new Date(infosCalendrier.date);
const decalage = dateServeur - Date.now();

// Heure du serveur, qui continue d'avancer
function maintenant() {
    return new Date(Date.now() + decalage);
}

// ===== Dates de référence =====
const unJour = 1000 * 60 * 60 * 24;
const premierDecembre = new Date(annee, 11, 1);
const noel = new Date(annee, 11, 25);

// ===== Stockage des jours ouverts =====
const cleStockage = `calendrier-avent-${annee}-jours-ouverts`;
const joursOuvertsTexte = localStorage.getItem(cleStockage);
const joursOuverts = joursOuvertsTexte === null ? [] : JSON.parse(joursOuvertsTexte);

function marquerOuvert(numeroJour) {
    if (joursOuverts.includes(numeroJour)) {
        return;
    }
    joursOuverts.push(numeroJour);
    localStorage.setItem(cleStockage, JSON.stringify(joursOuverts));
}

// ===== Calculs =====
function dernierJourOuvrable(dateCalcule) {
    const ecart = dateCalcule - premierDecembre;
    const numeroDuJour = Math.floor(ecart / unJour) + 1;

    if (numeroDuJour <= 0) {
        return 0;
    } else if (numeroDuJour >= 24) {
        return 24;
    } else {
        return numeroDuJour;
    }
}

// ===== Fenêtre cadeau =====
// Renvoie true si un cadeau a été affiché
async function afficherCadeau(numeroJour) {
    const reponse = await fetch(`/api/cadeaux/${numeroJour}`);

    titreFenetre.textContent = `Jour ${numeroJour}`;
    mediaFenetreCadeau.replaceChildren();

    if (reponse.status === 404) {
        texteFenetreCadeau.textContent = "Pas de cadeau pour ce jour… pour l'instant !";
        fenetreCadeau.showModal();
        return false;
    }
    if (!reponse.ok) {
        return false;
    }

    const cadeau = await reponse.json();
    texteFenetreCadeau.textContent = cadeau.texte;

    if (cadeau.typeMedia === "image") {
        const img = document.createElement("img");
        img.src = cadeau.lienMedia;
        img.alt = cadeau.texteAlt;
        mediaFenetreCadeau.appendChild(img);
    } else if (cadeau.typeMedia === "video") {
        const video = document.createElement("video");
        video.src = cadeau.lienMedia;
        video.controls = true;
        mediaFenetreCadeau.appendChild(video);
    }

    fenetreCadeau.showModal();
    return true;
}

// ===== Grille =====
function construireGrille(dernierJour) {
    grille.replaceChildren();
    for (let i = 1; i <= 24; i++) {
        const caseJour = document.createElement("li");
        caseJour.textContent = i;

        if (joursOuverts.includes(i)) {
            caseJour.classList.add("ouverte");
        }

        if (i <= dernierJour) {
            caseJour.addEventListener("click", async () => {
                const cadeauAffiche = await afficherCadeau(i);
                if (cadeauAffiche) {
                    marquerOuvert(i);
                    caseJour.classList.add("ouverte");
                }
            });
        } else {
            caseJour.classList.add("verrouillee");
            caseJour.addEventListener("click", () => {
                caseJour.classList.remove("secousse");
                void caseJour.offsetWidth;
                caseJour.classList.add("secousse");
            });
        }
        grille.appendChild(caseJour);
    }
}

// ===== Compte à rebours =====
let minuteur = null;

function mettreAJourCompteARebours() {
    const reste = premierDecembre - maintenant();

    if (reste <= 0) {
        clearInterval(minuteur);
        demarrer();
        return;
    }

    const jours = Math.floor(reste / unJour);
    const heures = Math.floor(reste / (1000 * 60 * 60)) % 24;
    const minutes = Math.floor(reste / (1000 * 60)) % 60;
    const secondes = Math.floor(reste / 1000) % 60;

    compteARebours.textContent = `${jours} j ${heures} h ${minutes} min ${secondes} s`;
}

// ===== Écrans =====
function afficherEcran(date, dernierJour) {
    ecranAttente.hidden = true;
    grille.hidden = true;
    ecranNoel.hidden = true;

    if (dernierJour === 0) {
        ecranAttente.hidden = false;
        mettreAJourCompteARebours();
        minuteur = setInterval(mettreAJourCompteARebours, 1000);
    } else if (date >= noel) {
        ecranNoel.hidden = false;
    } else {
        grille.hidden = false;
    }
}

// ===== Démarrage =====
function demarrer() {
    const date = maintenant();
    const dernierJour = dernierJourOuvrable(date);
    construireGrille(dernierJour);
    afficherEcran(date, dernierJour);
}

boutonFermerCadeau.addEventListener("click", () => {
    fenetreCadeau.close();
});
fenetreCadeau.addEventListener("close", () => {
    mediaFenetreCadeau.replaceChildren();
});
boutonNonOuverts.addEventListener("click", () => {
    ecranNoel.hidden = true;
    grille.hidden = false;
    grille.classList.add("non-ouverts");
});

demarrer();