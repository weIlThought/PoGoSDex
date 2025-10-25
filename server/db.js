import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '../data/devices.json');

const dir = join(__dirname, '../data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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
  try {
    // Try the normal atomic write (uses steno). On some environments the atomic rename
    // can fail with ENOENT; if that happens, fall back to a robust direct write.
    await db.write();
  } catch (e) {
    try {
      const json = JSON.stringify(db.data || defaultData, null, 2);
      await fs.promises.writeFile(file, json, 'utf8');
    } catch (e2) {
      // Re-throw original error if fallback also fails
      throw e;
    }
  }
  return db;
}

await initDB();

export default db;
