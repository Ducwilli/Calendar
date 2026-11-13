// ===== Éléments de la page =====
const listeCalendriers = document.getElementById("liste-calendriers");
const messageAucun = document.getElementById("aucun-calendrier");
const utilisateurConnecte = document.getElementById("utilisateur-connecte");
const boutonDeconnexion = document.getElementById("bouton-deconnexion");

// ===== Qui est connecté ? =====
const reponseMoi = await fetch("/api/moi");
if (!reponseMoi.ok) {
    // Session expirée entre-temps : retour à la connexion
    location.href = "/connexion";
    throw new Error("Utilisateur non connecté");
}
const { email } = await reponseMoi.json();
utilisateurConnecte.textContent = `Connecté en tant que ${email}`;

// ===== Les calendriers =====
function accorder(nombre, singulier, pluriel) {
    return `${nombre} ${nombre > 1 ? pluriel : singulier}`;
}

function creerCarte(calendrier) {
    const carte = document.createElement("li");

    const titre = document.createElement("h2");
    titre.textContent = `Calendrier ${calendrier.annee}`;

    const details = document.createElement("p");
    details.textContent = accorder(calendrier.nombreCadeaux, "cadeau", "cadeaux");

    const adresse = `${location.origin}/c/${calendrier.codePartage}`;
    const lien = document.createElement("a");
    lien.href = adresse;
    lien.textContent = adresse;

    const lienModifier = document.createElement("a");
    lienModifier.href = `/modifier/${calendrier.codePartage}`;
    lienModifier.className = "lien-modifier";
    lienModifier.textContent = "Modifier";

    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.type = "button";
    boutonSupprimer.className = "bouton-supprimer";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", () => {
        demanderSuppression(calendrier, carte, boutonSupprimer);
    });

    carte.append(titre, details, lien, lienModifier, boutonSupprimer);
    return carte;
}

// ===== Suppression, en deux clics pour éviter les accidents =====
async function demanderSuppression(calendrier, carte, bouton) {
    // Premier clic : le bouton demande une confirmation pendant 5 secondes
    if (bouton.dataset.confirmation !== "oui") {
        bouton.dataset.confirmation = "oui";
        bouton.textContent = "Confirmer la suppression";
        setTimeout(() => {
            bouton.dataset.confirmation = "";
            bouton.textContent = "Supprimer";
        }, 5000);
        return;
    }

    // Second clic : suppression
    bouton.disabled = true;
    const reponse = await fetch(`/api/calendriers/${encodeURIComponent(calendrier.codePartage)}`, {
        method: "DELETE"
    });

    if (reponse.status === 401) {
        location.href = "/connexion";
        return;
    }
    if (!reponse.ok) {
        bouton.disabled = false;
        bouton.textContent = "Échec, réessaie";
        return;
    }

    carte.remove();
    if (listeCalendriers.children.length === 0) {
        messageAucun.hidden = false;
    }
}

const reponseCalendriers = await fetch("/api/mes-calendriers");
const calendriers = await reponseCalendriers.json();

if (calendriers.length === 0) {
    messageAucun.hidden = false;
} else {
    for (const calendrier of calendriers) {
        listeCalendriers.appendChild(creerCarte(calendrier));
    }
}

// ===== Déconnexion =====
boutonDeconnexion.addEventListener("click", async () => {
    await fetch("/api/deconnexion", { method: "POST" });
    location.href = "/";
});