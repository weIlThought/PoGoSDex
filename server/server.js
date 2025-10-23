import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import crypto from "crypto";

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

import {
  getPokeminersVersionCached,
  schedulePokeminersAutoRefresh,
} from "./scrapers/pokeminers.js";
import {
  getPgsharpVersionCached,
  schedulePgsharpAutoRefresh,
} from "./scrapers/pgsharp.js";

app.get("/api/pgsharp/version", async (req, res) => {
  try {
    const result = await getPgsharpVersionCached();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/pokeminers/version", async (_req, res) => {
  try {
    const result = await getPokeminersVersionCached();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlRoutes = [
  { route: "/", file: "index.html" },
  { route: "/privacy.html", file: "privacy.html" },
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

  app.set("trust proxy", 1);

  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.cspNonce = nonce;

    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "connect-src 'self' data: https://api.uptimerobot.com",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "report-to csp-endpoint",
      "report-uri /csp-report",
    ].join("; ");

    res.setHeader("Content-Security-Policy", cspDirectives);
    res.setHeader(
      "Report-To",
      JSON.stringify({
        group: "csp-endpoint",
        max_age: 10886400,
        endpoints: [{ url: "/csp-report" }],
      })
    );

    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
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

  const staticRoot = path.resolve(__dirname, "..", "public");
  const htmlCache = new Map();
  const fsp = fs.promises;
  await Promise.all(
    htmlRoutes.map(async ({ file }) => {
      const fullPath = path.join(staticRoot, file);
      const content = await fsp.readFile(fullPath, "utf8");
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

  app.get("/data/coords.json", (req, res) => {
    const coordsPath = path.join(__dirname, "..", "data", "coords.json");
    res.type("application/json");
    res.sendFile(coordsPath, (err) => {
      if (err) {
        logger && logger.error
          ? logger.error(
              `❌ Fehler beim Senden der coords.json: ${String(err)}`
            )
          : console.error("❌ Fehler beim Senden der coords.json:", err);
        if (!res.headersSent) {
          res.status(404).json({ error: "coords.json not found" });
        } else {
          try {
            res.end();
          } catch (_) {}
        }
      } else {
        logger && logger.info
          ? logger.info(`📡 Coords-Datei ausgeliefert: ${coordsPath}`)
          : console.log("📡 Coords-Datei ausgeliefert:", coordsPath);
      }
    });
  });

  app.use(
    "/data",
    express.static(path.resolve(__dirname, "..", "data"), {
      index: false,
      setHeaders(res) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      },
    })
  );

  app.use(
    "/lang",
    express.static(path.resolve(__dirname, "..", "lang"), {
      index: false,
      maxAge: "1h",
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

  logger.info(`[startup] staticRoot=${staticRoot}`);
  try {
    await fsp.access(path.join(staticRoot, "index.html"), fs.constants.R_OK);
    logger.info("[startup] index.html found in staticRoot");
  } catch (err) {
    logger.warn(
      "[startup] index.html NOT found in staticRoot - this may cause GET / to 404"
    );
  }

  for (const { route, file } of htmlRoutes) {
    app.get(route, (req, res) => {
      const content = htmlCache.get(file);
      if (!content) {
        return res.status(404).send("Not found");
      }

      let out = content.replace(/{{CSP_NONCE}}/g, res.locals.cspNonce || "");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(out);
    });
  }

  app.use((req, res, next) => {
    if (req.path === "/data/coords.json") {
      logger.info(
        `[coords-request] ${req.ip} ${req.method} ${
          req.path
        } headers=${JSON.stringify(
          req.headers && { accept: req.get("accept") }
        )}`
      );
    }
    next();
  });
  schedulePgsharpAutoRefresh(logger);
  schedulePokeminersAutoRefresh(logger);
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
