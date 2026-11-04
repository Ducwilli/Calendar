const grille = document.getElementById("grille");
const titreFenetre = document.getElementById("cadeau-titre");
const fenetreCadeau = document.getElementById("fenetre-cadeau");
const texteFenetreCadeau = document.getElementById("cadeau-texte");
const mediaFenetreCadeau = document.getElementById("cadeau-media");
const boutonFermerCadeau = document.getElementById("cadeau-fermer");

function afficherCadeau(numeroJour){
    const cadeau = calendrierAvent.cadeaux.find((c) => c.jour === numeroJour);

    if (cadeau === undefined){return;}
    titreFenetre.textContent = `Jour ${numeroJour}`;
    texteFenetreCadeau.textContent = cadeau.texte;

    if (cadeau.typeMedia === "image"){
    }
    if (cadeau.typeMedia === "video"){
    }
    fenetreCadeau.showModal();
};

for (let i = 1; i <= 24; i++){
    const caseJour = document.createElement("li");
    caseJour.textContent = i;
    caseJour.addEventListener("click", () => {
        afficherCadeau(i);
    });
    grille.appendChild(caseJour);
}

boutonFermerCadeau.addEventListener("click", () => {fenetreCadeau.close()});