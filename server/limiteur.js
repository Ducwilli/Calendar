// ===== Limitation du nombre d'essais =====
// Compte les essais par « clé » (une adresse IP, un email, un utilisateur…)
// sur une fenêtre de temps glissante, et bloque au-delà d'un maximum.
// Les compteurs sont gardés en mémoire : ils repartent à zéro si le serveur redémarre.

export function creerLimiteur({ maximum, fenetre }) {
    const essais = new Map();   // clé → { nombre, debut }

    function lire(cle) {
        const maintenant = Date.now();
        let entree = essais.get(cle);
        if (entree === undefined || maintenant - entree.debut > fenetre) {
            entree = { nombre: 0, debut: maintenant };
            essais.set(cle, entree);
        }
        return entree;
    }

    // Supprime de temps en temps les compteurs périmés, pour ne pas remplir la mémoire
    const nettoyage = setInterval(() => {
        const maintenant = Date.now();
        for (const [cle, entree] of essais) {
            if (maintenant - entree.debut > fenetre) {
                essais.delete(cle);
            }
        }
    }, fenetre);
    nettoyage.unref();   // ce minuteur n'empêche pas le programme de s'arrêter

    return {
        // { bloque, secondesRestantes } : la clé a-t-elle atteint le maximum ?
        verifier(cle) {
            const entree = lire(cle);
            return {
                bloque: entree.nombre >= maximum,
                secondesRestantes: Math.ceil((entree.debut + fenetre - Date.now()) / 1000)
            };
        },
        // Compte un essai de plus pour cette clé
        compter(cle) {
            lire(cle).nombre++;
        },
        // Remet le compteur de cette clé à zéro (par exemple après une connexion réussie)
        oublier(cle) {
            essais.delete(cle);
        }
    };
}

// Répond 429 « Too Many Requests », avec l'en-tête Retry-After (en secondes)
export function repondreTropDEssais(reponse, secondesRestantes) {
    const minutes = Math.max(1, Math.ceil(secondesRestantes / 60));
    reponse.set("Retry-After", String(secondesRestantes));
    reponse.status(429).json({
        erreur: `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`
    });
}

// Middleware : compte chaque requête avec la clé donnée par une fonction, et bloque au-delà
export function limiter(limiteur, choisirCle) {
    return (requete, reponse, suivant) => {
        const cle = choisirCle(requete);
        const etat = limiteur.verifier(cle);
        if (etat.bloque) {
            return repondreTropDEssais(reponse, etat.secondesRestantes);
        }
        limiteur.compter(cle);
        suivant();
    };
}
