// ===== Éléments de la page =====
const formulaire = document.getElementById("formulaire-connexion");
const champEmail = document.getElementById("email");
const champMotDePasse = document.getElementById("mot-de-passe");
const messageErreur = document.getElementById("message-erreur");
const boutonEnvoyer = formulaire.querySelector("button[type='submit']");

// ===== Envoi du formulaire =====
formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";
    boutonEnvoyer.disabled = true;

    let reponse;
    try {
        reponse = await fetch("/api/connexion", {
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
        champMotDePasse.value = "";
        champMotDePasse.focus();
        return;
    }

    // Session ouverte : retour à l'accueil
    location.href = "/";
});