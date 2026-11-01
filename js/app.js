const grille = document.getElementById("grille");
for (let i = 1; i <= 24; i++){
    const caseJour = document.createElement("li");
    caseJour.textContent = i;
    grille.appendChild(caseJour);
}