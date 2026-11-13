// ===== Éléments de la page =====
const formulaireCode = document.querySelector("form");
const champCode = document.getElementById("code");
const messageErreur = document.getElementById("paragraphe-erreur");
const zoneVisiteur = document.getElementById("zone-visiteur");
const zoneConnecte = document.getElementById("zone-connecte");
const utilisateurConnecte = document.getElementById("utilisateur-connecte");
const boutonDeconnexion = document.getElementById("bouton-deconnexion");

// ===== Connecté ou non ? =====
const reponseMoi = await fetch("/api/moi");
if (reponseMoi.ok) {
    const { email } = await reponseMoi.json();
    utilisateurConnecte.textContent = `Connecté en tant que ${email}`;
    zoneConnecte.hidden = false;
} else {
    zoneVisiteur.hidden = false;
}

boutonDeconnexion.addEventListener("click", async () => {
    await fetch("/api/deconnexion", { method: "POST" });
    location.reload();
});

// ===== Nettoyage du code tapé =====
// Accepte un code seul ("k7Qp2xVa") ou un lien complet (".../c/k7Qp2xVa")
function extraireCode(texte) {
    const nettoye = texte.trim();
    if (nettoye.includes("/c/")) {
        return nettoye.split("/c/")[1].split("/")[0];
    }
    return nettoye;
}

// ===== Envoi du formulaire =====
formulaireCode.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    messageErreur.textContent = "";

    const code = extraireCode(champCode.value);
    if (code === "") {
        messageErreur.textContent = "Entre le code qu'on t'a envoyé.";
        return;
    }

    const reponse = await fetch(`/api/calendriers/${encodeURIComponent(code)}`);
    if (!reponse.ok) {
        messageErreur.textContent = "Ce code ne correspond à aucun calendrier. Vérifie les majuscules et minuscules.";
        return;
    }

    location.href = `/c/${encodeURIComponent(code)}`;
});