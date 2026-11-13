import { join } from "node:path";

export const racine = join(import.meta.dirname, "..");
export const cheminDB = join(racine, "calendrier.db");
export const cheminPublic = join(racine, "public");
export const cheminUploads = join(racine, "uploads");