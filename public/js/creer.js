import { construireChampsCadeaux, preparerFormData } from "./formulaire-calendrier.js";

// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-creation");
const champAnnee = document.getElementById("annee");
const listeCadeaux = document.getElementById("liste-cadeaux");
const messageErreur = document.getElementById("message-erreur");
const sectionResultat = document.getElementById("resultat");
const lienPartage = document.getElementById("lien-partage");
const boutonCreer = formulaire.querySelector("button[type='submit']");

// ===== Le formulaire =====
champAnnee.value = new Date().getFullYear();
const jours = construireChampsCadeaux(listeCadeaux);

// ===== Envoi du formulaire =====
formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";

    const donnees = preparerFormData(champAnnee, jours, messageErreur);
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

    if (reponse.status === 401) {
        messageErreur.textContent = "Ta session a expiré. Reconnecte-toi, puis recommence (tes fichiers devront être choisis à nouveau).";
        return;
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
