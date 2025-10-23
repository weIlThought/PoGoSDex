import fs from "fs";
import path from "path";
import axios from "axios";
import { load } from "cheerio";
import db from "../db.js";

async function getPokeminersApkVersion() {
  const res = await fetch("https://pokeminers.com");
  const html = await res.text();

  
  const h6 = html.match(
    /<h6[^>]*class=["'][^"']*status-highlight[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i
  );
  if (!h6) return { ok: false, raw: html.slice(0, 500) };

  const inner = h6[1].replace(/\s+/g, " ").trim();
  const v = inner.match(/([\d]+\.[\d.]+)/);
  if (!v) return { ok: false, raw: inner };

  return { ok: true, apkVersion: v[1], raw: inner };
}

export { getPokeminersApkVersion };
