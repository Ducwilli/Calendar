// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-inscription");
const champEmail = document.getElementById("email");
const champMotDePasse = document.getElementById("mot-de-passe");
const champConfirmation = document.getElementById("confirmation");
const messageErreur = document.getElementById("message-erreur");
const boutonEnvoyer = formulaire.querySelector("button[type='submit']");

// ===== Envoi du formulaire =====
formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";

    if (champMotDePasse.value !== champConfirmation.value) {
        messageErreur.textContent = "Les deux mots de passe ne sont pas identiques.";
        champConfirmation.focus();
        return;
    }

    boutonEnvoyer.disabled = true;

    let reponse;
    try {
        reponse = await fetch("/api/inscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: champEmail.value,
                motDePasse: champMotDePasse.value
            })
        });
    } catch {
        messageErreur.textContent = "Impossible de joindre le serveur. Vérifie ta connexion.";
        return;
    } finally {
        boutonEnvoyer.disabled = false;
    }

    if (!reponse.ok) {
        const probleme = await reponse.json();
        messageErreur.textContent = probleme.erreur;
        return;
    }

    // Compte créé et session ouverte : retour à l'accueil
    location.href = "/";
});