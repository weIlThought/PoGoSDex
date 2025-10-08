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

// Default data structure
const defaultData = { devices: [] };

// Create database adapter
const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

// Initialize database file if not exists
await db.read();
if (!db.data) {
  db.data = defaultData;
  await db.write();
}

export default db;
