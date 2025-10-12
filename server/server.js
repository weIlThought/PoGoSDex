import dotenv from "dotenv";
dotenv.config();

import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import xssClean from "xss-clean";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { initDB } from "./db.js";

// ESM hat kein __dirname automatisch – selbst definieren:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Sicherheit & Middleware
app.disable("x-powered-by");
app.use(helmet());
app.use(xssClean());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

const scrapeBuckets = new Map();
const SCRAPE_WINDOW_MS = 30_000;
const SCRAPE_THRESHOLD = 45;
setInterval(() => {
  const cutoff = Date.now() - SCRAPE_WINDOW_MS;
  for (const [ip, hits] of scrapeBuckets.entries()) {
    const filtered = hits.filter((ts) => ts >= cutoff);
    if (filtered.length) {
      scrapeBuckets.set(ip, filtered);
    } else {
      scrapeBuckets.delete(ip);
    }
  }
}, 300_000).unref();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const burstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: false,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use(burstLimiter);
app.use((req, res, next) => {
  const ua = req.get("user-agent");
  if (!ua || /curl|wget|python|scrapy|httpclient/i.test(ua)) {
    return res.status(403).send("Forbidden");
  }
  next();
});
app.use((req, res, next) => {
  const now = Date.now();
  const bucket = scrapeBuckets.get(req.ip) || [];
  const recent = bucket.filter((ts) => now - ts < SCRAPE_WINDOW_MS);
  recent.push(now);
  scrapeBuckets.set(req.ip, recent);
  if (recent.length > SCRAPE_THRESHOLD) {
    return res.status(429).send("Too many requests");
  }
  next();
});
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Starte Server
(async () => {
  await initDB();

  const staticRoot = path.resolve(__dirname, "..", "public");
  app.use(express.static(staticRoot, { extensions: ["html"] }));
  app.use("/data", express.static(path.resolve(__dirname, "..", "data")));
  app.use("/lang", express.static(path.resolve(__dirname, "..", "lang")));

  // Fallback für SPA (React/Vue/etc.)
  app.get("*", (req, res) => res.sendFile(path.join(staticRoot, "index.html")));

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();
