const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs');
const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const devicesFile = path.join(dataDir, 'devices.json');
if (!fs.existsSync(devicesFile)) { fs.writeFileSync(devicesFile, JSON.stringify([], null, 2), 'utf8'); }
const adapter = new JSONFile(devicesFile);
const db = new Low(adapter);
async function initDB(){ await db.read(); db.data = db.data || []; await db.write(); }
module.exports = { db, initDB, devicesFile };