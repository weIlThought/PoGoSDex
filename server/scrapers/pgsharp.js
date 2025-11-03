
import axios from "axios";
import { load } from "cheerio";

const PGSHARP_URL = "https://www.pgsharp.com";
const DEFAULT_USER_AGENT =
  "PoGoSDex-Scraper/1.3 (+https://github.com/weIlThought/PoGoSDex)";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; 

async function getPgsharpVersion() {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await axios.get(PGSHARP_URL, {
      timeout: 10000,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      responseType: "text",
      maxRedirects: 5,
    });

    if (res.status !== 200) {
      return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    }

    const html = String(res.data || "");
    const $ = load(html);

    let pageVersion = null;
    let pogoVersion = null;

    const allText = $("body").text();

    const match = /Latest Version:\s*([\d.]+)\s*\(([\d.]+-?G?)\)/i.exec(
      allText
    );
    if (match) {
      pageVersion = match[1].trim();
      pogoVersion = match[2].trim();
    } else {
      const simple = /Latest Version:\s*([\d.]+)/i.exec(allText);
      if (simple) pageVersion = simple[1].trim();
    }

    if (!pageVersion) {
      return { ok: false, error: "No version found", fetchedAt };
    }

    return {
      ok: true,
      pageVersion,
      pogoVersion,
      fetchedAt,
      source: PGSHARP_URL,
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), fetchedAt };
  }
}

export async function getPgsharpVersionCached(force = false) {
  const now = Date.now();
  if (!force && cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return { ...cache.data, cached: true };
  }

  const result = await getPgsharpVersion();
  if (result.ok) cache = { data: result, timestamp: now };
  return result;
}

export function schedulePgsharpAutoRefresh(logger = console) {
  let lastVersion = null;

  const runScrape = async () => {
    const result = await getPgsharpVersionCached(true);
    if (result.ok) {
      if (result.pageVersion !== lastVersion) {
        logger.info?.(
          `[pgsharp] updated → ${result.pageVersion} (${result.pogoVersion})`
        );
        lastVersion = result.pageVersion;
      } else {
        logger.debug?.(
          `[pgsharp] same version (${result.pageVersion}), no change`
        );
      }
    } else {
      logger.warn?.(`[pgsharp] refresh failed: ${result.error}`);
    }
  };

  runScrape();

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(now.getHours() + 1);
  const delay = nextHour - now;

  setTimeout(() => {
    runScrape();
    setInterval(runScrape, 60 * 60 * 1000).unref();
  }, delay).unref();
}

export { getPgsharpVersion };
