// /server/db.js
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Resolve data directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "../data/devices.json");

// Ensure data folder exists
const dir = join(__dirname, "../data");
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

// Default data structure (array expected by routes / frontend)
const defaultData = {
  // minimale Default‑Struktur (anpassen falls dein Code andere Keys erwartet)
  uptime: [],
  devices: [],
  news: [],
};
const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

// Exported init function to initialize/read DB
export async function initDB() {
  await db.read();
  // sicherstellen, dass Daten vorhanden sind
  db.data = db.data || defaultData;
  await db.write();
  return db;
}

// Initialize immediately (optional) so other modules can use DB early
await initDB();

export default db;
