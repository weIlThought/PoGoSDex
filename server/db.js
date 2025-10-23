import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "../data/devices.json");

const dir = join(__dirname, "../data");
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const defaultData = {
  uptime: [],
  devices: [],
  news: [],
};
const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

export async function initDB() {
  await db.read();
  db.data = db.data || defaultData;
  await db.write();
  return db;
}

await initDB();

export default db;
