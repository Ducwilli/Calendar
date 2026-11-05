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

// ===== Dates de référence =====
const unJour = 1000 * 60 * 60 * 24;
const premierDecembre = null;               //new Date(calendrierAvent.annee, 11, 1);
const noel = new Date(calendrierAvent.annee, 11, 25);

// ===== Stockage des jours ouverts =====
const cleStockage = `calendrier-avent-${calendrierAvent.annee}-jours-ouverts`;
const joursOuvertsTexte = localStorage.getItem(cleStockage);
const joursOuverts = joursOuvertsTexte === null ? [] : JSON.parse(joursOuvertsTexte);

function marquerOuvert(numeroJour) {
    if (joursOuverts.includes(numeroJour)) {
        return;
    }
    joursOuverts.push(numeroJour);
    localStorage.setItem(cleStockage, JSON.stringify(joursOuverts));
}

// ===== Simulation de date (mettre null pour la vraie date) =====
const dateSimulee = new Date(calendrierAvent.annee, 11, 7, 16, 37);
const decalage = dateSimulee === null ? 0 : dateSimulee - Date.now();

function maintenant() {
    return new Date(Date.now() + decalage);
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
function afficherCadeau(numeroJour) {
    const cadeau = calendrierAvent.cadeaux.find((c) => c.jour === numeroJour);

    if (cadeau === undefined) { return; }
    titreFenetre.textContent = `Jour ${numeroJour}`;
    texteFenetreCadeau.textContent = cadeau.texte;

    mediaFenetreCadeau.replaceChildren();
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
            caseJour.addEventListener("click", () => {
                afficherCadeau(i);
                marquerOuvert(i);
                caseJour.classList.add("ouverte");
            });
        } else {
            caseJour.classList.add("verrouillee");
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
});

demarrer();