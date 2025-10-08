import { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

const defaultData = { devices: [] };
const db = await JSONFilePreset("./data/devices.json", defaultData);

export default db;
