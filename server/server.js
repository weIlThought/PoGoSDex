import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { fileURLToPath } from "url";
import { initDB } from "./db.js";
import { validateData } from "./validate-data.js";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlRoutes = [
  { route: "/", file: "index.html" },
  { route: "/privacy.html", file: "privacy.html" },
  // { route: "/impressum.html", file: "impressum.html" },
  { route: "/tos.html", file: "tos.html" },
];

const uptimeCache = {
  payload: null,
  timestamp: 0,
};

export async function createServer() {
  const port = Number(process.env.PORT || 3000);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  const trustProxyInput = (process.env.TRUST_PROXY || "").trim().toLowerCase();
  let trustProxy = false;

  if (trustProxyInput === "loopback" || trustProxyInput === "true") {
    trustProxy = "loopback";
  } else if (trustProxyInput === "false" || trustProxyInput === "") {
    trustProxy = false;
  } else if (/^\d+$/.test(trustProxyInput)) {
    trustProxy = Number(trustProxyInput);
  } else if (trustProxyInput) {
    trustProxy = trustProxyInput;
  }

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

  // Set trust proxy for correct client IP detection (important for rate limiting behind proxies)
  app.set("trust proxy", 1);

  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  const connectOrigins =
    allowedOrigin === "*"
      ? ["'self'", "*", "data:", "https://pagead2.googlesyndication.com"]
      : [
          "'self'",
          "data:",
          "https://pagead2.googlesyndication.com",
          ...allowedOrigin.split(",").map((value) => value.trim()),
        ];

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
          frameSrc: ["'self'", "https://challenges.cloudflare.com"],
          // weitere Direktiven wie nötig
        },
      },
    })
  );

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
      const params = new URLSearchParams();
      params.append("api_key", uptimeApiKey);
      params.append("format", "json");
      params.append("logs", "0");
      params.append("custom_uptime_ratios", "1-7-30");

      const response = await fetch(
        "https://api.uptimerobot.com/v2/getMonitors",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
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

  app.get("/api/uptime", async (req, res) => {
    try {
      const apiKey = process.env.UPTIMEROBOT_API_KEY;
      // Monitor-ID ggf. aus .env oder fest eintragen
      const monitorID = "801563784";
      const response = await fetch(
        `https://api.uptimerobot.com/v2/getMonitors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `api_key=${apiKey}&monitors=${monitorID}&format=json`,
        }
      );
      const data = await response.json();
      const uptime = data.monitors?.[0]?.all_time_uptime_ratio;
      if (uptime) {
        res.json({ uptime: parseFloat(uptime) });
      } else {
        res.json({ uptime: null });
      }
    } catch (e) {
      res.json({ uptime: null });
    }
  });

  app.post(
    "/api/turnstile-verify",
    express.urlencoded({ extended: false }),
    async (req, res) => {
      const token = req.body["cf-turnstile_response"];
      const remoteip =
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip;

      // Hole Secret NUR aus Railway-Umgebungsvariablen!
      const secret = process.env.TURNSTILE_SECRET;
      if (!secret) {
        return res
          .status(500)
          .json({ success: false, error: "Missing secret" });
      }
      if (!token) {
        return res.status(400).json({ success: false, error: "Missing token" });
      }

      try {
        const params = new URLSearchParams();
        params.append("secret", secret);
        params.append("response", token);
        params.append("remoteip", remoteip);

        const response = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: params,
          }
        );
        const result = await response.json();

        // Optional: weitere Checks (Hostname, Action etc.)
        // if (result.success && result.hostname !== "pogosdex.com") { ... }

        res.json(result);
      } catch (err) {
        res.status(500).json({ success: false, error: "Internal error" });
      }
    }
  );

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

  app.use((req, res) => {
    if (req.method !== "GET") {
      return res.status(404).end();
    }

    const nonce = res.locals.cspNonce;
    const template = htmlCache.get("index.html");
    const html = template.replace(/{{CSP_NONCE}}/g, nonce);
    res.type("html").send(html);
  });

  app.use((err, _req, res, _next) => {
    logger.error(`Unhandled error: ${err.stack || err.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com"
    );
    next();
  });

  return { app, port, logger };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer()
    .then(({ app, port, logger }) => {
      app.listen(port, () => {
        logger.info(`✅ Server running on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}
