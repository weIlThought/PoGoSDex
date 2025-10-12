import dotenv from "dotenv";
dotenv.config();

import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import xssClean from "xss-clean";
import compression from "compression";
import morgan from "morgan";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { initDB } from "./db.js";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const TRUST_PROXY = Number(process.env.TRUST_PROXY || 0);

if (TRUST_PROXY) {
  app.set("trust proxy", TRUST_PROXY);
}

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "https:"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'", ALLOWED_ORIGIN],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(xssClean());
app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(","),
    credentials: true,
    maxAge: 86400,
  })
);
app.use(compression());
app.use(
  morgan("combined", {
    skip: (_req, res) => res.statusCode < 400,
  })
);

const scrapeBuckets = new Map();
const SCRAPE_WINDOW_MS = 30_000;
const SCRAPE_THRESHOLD = 45;

setInterval(() => {
  const cutoff = Date.now() - SCRAPE_WINDOW_MS;
  for (const [ip, hits] of scrapeBuckets.entries()) {
    const filtered = hits.filter((ts) => ts >= cutoff);
    if (filtered.length) scrapeBuckets.set(ip, filtered);
    else scrapeBuckets.delete(ip);
  }
}, 300_000).unref();

const globalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
const burstLimiter = rateLimit({
  windowMs: 45 * 1000,
  limit: 60,
  standardHeaders: false,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use(burstLimiter);

app.use((req, res, next) => {
  const ua = req.get("user-agent") || "";
  if (!ua || /curl|wget|python|scrapy|httpclient|httpx/i.test(ua)) {
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

(async () => {
  await initDB();

  const staticRoot = path.resolve(__dirname, "..", "public");
  app.use(
    express.static(staticRoot, {
      extensions: ["html"],
      etag: true,
      maxAge: "12h",
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=43200, immutable");
      },
    })
  );
  app.use(
    "/data",
    express.static(path.resolve(__dirname, "..", "data"), {
      maxAge: "1h",
      immutable: false,
    })
  );
  app.use(
    "/lang",
    express.static(path.resolve(__dirname, "..", "lang"), {
      maxAge: "1h",
    })
  );

  app.use((req, res, next) => {
    if (req.method === "GET") {
      return res.sendFile(path.join(staticRoot, "index.html"));
    }
    next();
  });

  app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const { port, logger } = await createApp();

  app.listen(port, () => {
    logger.info(`✅ Server running on port ${port}`);
  });
})();
