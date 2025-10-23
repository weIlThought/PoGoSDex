import axios from "axios";
import { load } from "cheerio";

const POKEMINERS_URL = "https://pokeminers.com";
const DEFAULT_USER_AGENT =
  "PoGoSDex-Scraper/1.2 (+https://github.com/weIlThought/PoGoSDex)";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getPokeminersApkVersion() {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await axios.get(POKEMINERS_URL, {
      timeout: 10000,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      responseType: "text",
    });

    if (res.status !== 200) {
      return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    }

    const html = String(res.data || "");
    const $ = load(html);

    const text = $("h6.status-highlight").first().text().trim();
    const v = text.match(/([\d]+\.[\d.]+)/);

    if (!v) {
      return { ok: false, error: "No version found", fetchedAt };
    }

    return {
      ok: true,
      apkVersion: v[1],
      fetchedAt,
      source: POKEMINERS_URL,
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), fetchedAt };
  }
}

export async function getPokeminersVersionCached(force = false) {
  const now = Date.now();
  if (!force && cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return { ...cache.data, cached: true };
  }

  const result = await getPokeminersApkVersion();
  if (result.ok) cache = { data: result, timestamp: now };
  return result;
}

export function schedulePokeminersAutoRefresh(logger = console) {
  let lastVersion = null;

  const runScrape = async () => {
    const result = await getPokeminersVersionCached(true);
    if (result.ok) {
      if (result.apkVersion !== lastVersion) {
        logger.info?.(`[pokeminers] updated → ${result.apkVersion}`);
        lastVersion = result.apkVersion;
      } else {
        logger.debug?.(
          `[pokeminers] same version (${result.apkVersion}), no change`
        );
      }
    } else {
      logger.warn?.(`[pokeminers] refresh failed: ${result.error}`);
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
