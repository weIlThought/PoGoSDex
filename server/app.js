import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import xssClean from "xss-clean";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { fileURLToPath } from "url";
import { initDB } from "./db.js";
import { validateData } from "./validate-data.js";

const htmlRoutes = [
  { route: "/", file: "index.html" },
  { route: "/privacy.html", file: "privacy.html" },
  { route: "/impressum.html", file: "impressum.html" },
  { route: "/tos.html", file: "tos.html" },
];

const uptimeCache = {
  payload: null,
  timestamp: 0,
};

export async function createApp() {
  const port = Number(process.env.PORT || 3000);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  const uptimeApiKey = process.env.UPTIMEROBOT_API_KEY || "";

  const logger = winston.createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
      )
    ),
    transports: [new winston.transports.Console()],
  });

  await initDB();
  await validateData(logger);

  const app = express();

  if (trustProxy) {
    app.set("trust proxy", trustProxy);
  }

  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  const connectOrigins =
    allowedOrigin === "*"
      ? ["*"]
      : ["'self'", ...allowedOrigin.split(",").map((value) => value.trim())];

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:", "https:"],
          "script-src": [
            "'self'",
            (_req, res) => `'nonce-${res.locals.cspNonce}'`,
          ],
          "style-src": ["'self'", "'unsafe-inline'"],
          "connect-src": connectOrigins,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(xssClean());
  app.use(
    cors({
      origin: allowedOrigin === "*" ? true : allowedOrigin.split(","),
      credentials: true,
      maxAge: 86400,
    })
  );
  app.use(compression());
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

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

  app.get("/healthz", (_req, res) =>
    res.status(200).json({ status: "ok", uptime: process.uptime() })
  );

  app.get("/status/uptime", async (_req, res) => {
    if (!uptimeApiKey) {
      return res
        .status(501)
        .json({ error: "Uptime monitoring not configured" });
    }

    const now = Date.now();
    if (uptimeCache.payload && now - uptimeCache.timestamp < 3 * 60 * 1000) {
      return res.json(uptimeCache.payload);
    }

    try {
      const response = await fetch(
        "https://api.uptimerobot.com/v2/getMonitors",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: uptimeApiKey,
            format: "json",
            logs: 0,
            custom_uptime_ratios: "1-7-30",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`UptimeRobot HTTP ${response.status}`);
      }

      const json = await response.json();
      if (
        json.stat !== "ok" ||
        !Array.isArray(json.monitors) ||
        !json.monitors.length
      ) {
        throw new Error("Invalid UptimeRobot payload");
      }

      const monitor = json.monitors[0];
      const statusCode = Number(monitor.status);
      const uptimeRatio = Number(monitor.all_time_uptime_ratio);

      let state = "unknown";
      if (statusCode === 2) state = "up";
      else if (statusCode === 9) state = "degraded";
      else if ([0, 1, 8].includes(statusCode)) state = "down";

      const payload = {
        state,
        statusCode,
        uptimeRatio: Number.isFinite(uptimeRatio) ? uptimeRatio : null,
        checkedAt: monitor.create_datetime
          ? monitor.create_datetime * 1000
          : null,
      };

      uptimeCache.payload = payload;
      uptimeCache.timestamp = now;

      return res.json(payload);
    } catch (error) {
      return res.status(502).json({ error: "Failed to fetch uptime status" });
    }
  });

  const staticRoot = path.resolve(__dirname, "..", "public");
  const htmlCache = new Map();
  await Promise.all(
    htmlRoutes.map(async ({ file }) => {
      const fullPath = path.join(staticRoot, file);
      const content = await fs.readFile(fullPath, "utf8");
      htmlCache.set(file, content);
    })
  );

  app.use(
    express.static(staticRoot, {
      index: false,
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
      index: false,
      maxAge: "1h",
    })
  );

  app.use(
    "/lang",
    express.static(path.resolve(__dirname, "..", "lang"), {
      index: false,
      maxAge: "1h",
    })
  );

  htmlRoutes.forEach(({ route, file }) => {
    app.get(route, (_req, res) => {
      const nonce = res.locals.cspNonce;
      const template = htmlCache.get(file);
      const html = template.replace(/{{CSP_NONCE}}/g, nonce);
      res.type("html").send(html);
    });
  });

  app.get("*", (_req, res) => {
    const nonce = res.locals.cspNonce;
    const template = htmlCache.get("index.html");
    const html = template.replace(/{{CSP_NONCE}}/g, nonce);
    res.type("html").send(html);
  });

  app.use((err, _req, res, _next) => {
    logger.error(`Unhandled error: ${err.stack || err.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return { app, port, logger };
}
