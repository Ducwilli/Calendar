// ===== Fuseau horaire du serveur =====
// Le calendrier vit à l'heure française, quel que soit l'endroit où tourne le serveur
// (un hébergeur est souvent réglé sur l'heure UTC, qui a 1 heure de retard en hiver).
// Ce fichier est importé en tout premier par index.js et remplir.js : le fuseau doit être
// fixé avant que la moindre date ne soit calculée.
process.env.TZ = "Europe/Paris";
