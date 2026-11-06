import express from "express";

const app = express();

app.get("/api/statut", (requete, reponse) => {
    reponse.json({ statut: "ok" });
});

app.use(express.static("public"));

app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});