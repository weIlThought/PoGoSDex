import fs from "fs";
import path from "path";
import axios from "axios";
import { load } from "cheerio";
import db from "../db.js";

async function getPgsharpVersion() {
  const res = await fetch("https://www.pgsharp.com");
  const html = await res.text();

  
  const m = html.match(/Latest Version:\s*([\d.]+)\s*\(([^)]+)\)/i);
  if (!m) return { ok: false, raw: html.slice(0, 500) };

  const pageVersion = m[1];
  const inner = m[2];
  const apkMatch = inner.match(/([\d.]+)/);
  const apkVersion = apkMatch ? apkMatch[1] : null;

  return { ok: true, pageVersion, apkVersion, rawInner: inner };
}

export { getPgsharpVersion };
