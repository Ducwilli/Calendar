import { construireChampsCadeaux, preRemplirChamps, preparerFormData } from "./formulaire-calendrier.js";

// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-modification");
const champAnnee = document.getElementById("annee");
const listeCadeaux = document.getElementById("liste-cadeaux");
const messageErreur = document.getElementById("message-erreur");
const messageSucces = document.getElementById("message-succes");
const lienPartage = document.getElementById("lien-partage");
const boutonEnregistrer = formulaire.querySelector("button[type='submit']");

// ===== Le calendrier à modifier : son code est dans l'adresse (/modifier/CODE) =====
const codePartage = location.pathname.split("/")[2];
const jours = construireChampsCadeaux(listeCadeaux);

// Charge le calendrier depuis le serveur et remplit le formulaire
async function charger() {
    const reponse = await fetch(`/api/calendriers/${encodeURIComponent(codePartage)}/edition`);

    if (reponse.status === 401) {
        location.href = "/connexion";
        return;
    }
    if (!reponse.ok) {
        const probleme = await reponse.json();
        messageErreur.textContent = probleme.erreur;
        boutonEnregistrer.disabled = true;
        return;
    }

    const calendrier = await reponse.json();
    champAnnee.value = calendrier.annee;
    preRemplirChamps(jours, calendrier.cadeaux);

    const adresse = `${location.origin}/c/${codePartage}`;
    const lien = document.createElement("a");
    lien.href = adresse;
    lien.textContent = adresse;
    lienPartage.replaceChildren("Lien de partage : ", lien);
}

await charger();

// ===== Enregistrement =====
formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";
    messageSucces.textContent = "";

    const donnees = preparerFormData(champAnnee, jours, messageErreur);
    if (donnees === null) {
        return;
    }

    boutonEnregistrer.disabled = true;
    boutonEnregistrer.textContent = "Enregistrement…";

    let reponse;
    try {
        reponse = await fetch(`/api/calendriers/${encodeURIComponent(codePartage)}`, {
            method: "PUT",
            body: donnees
        });
    } catch {
        messageErreur.textContent = "Impossible de joindre le serveur. Vérifie ta connexion.";
        return;
    } finally {
        boutonEnregistrer.disabled = false;
        boutonEnregistrer.textContent = "Enregistrer les modifications";
    }

    if (reponse.status === 401) {
        messageErreur.textContent = "Ta session a expiré. Reconnecte-toi, puis recommence.";
        return;
    }

    if (!reponse.ok) {
        const probleme = await reponse.json();
        messageErreur.textContent = probleme.erreur;
        return;
    }

    // Recharge le calendrier enregistré : les aperçus montrent les nouveaux médias
    await charger();
    messageSucces.textContent = "Modifications enregistrées !";
});
