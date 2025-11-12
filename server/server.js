import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { fileURLToPath } from 'url';
import { migrate, seedAdminIfNeeded, getPool } from './mysql.js';
import {
  authMiddleware,
  handleLogin,
  handleLogout,
  requireAuth,
  requireCsrf,
  meHandler,
} from './auth.js';
import { validateData } from './validate-data.js';
import {
  validateDevicePayload,
  validateNewsPayload,
  validateCoordPayload,
  validateIssuePayload,
} from './validators.js';

import {
  getPokeminersVersionCached,
  schedulePokeminersAutoRefresh,
} from './scrapers/pokeminers.js';
import { getPgsharpVersionCached, schedulePgsharpAutoRefresh } from './scrapers/pgsharp.js';
import { PAGINATION, RATE_LIMIT, TIMEOUT, CACHE } from './config/constants.js';
import { validateEnvironment } from './utils/env-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlRoutes = [
  { route: '/', file: 'index.html' },
  { route: '/privacy.html', file: 'privacy.html' },
  { route: '/tos.html', file: 'tos.html' },
];

const uptimeCache = {
  payload: null,
  timestamp: 0,
};

export async function createServer() {
  const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  // Validate environment variables before starting (skip in test mode)
  if (!isTest) {
    validateEnvironment();
  }

  const port = Number(process.env.PORT || 3000);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  const trustProxyInput = (process.env.TRUST_PROXY || '').trim().toLowerCase();
  let trustProxy = false;
  const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || TIMEOUT.DEFAULT_FETCH_MS);
  // Static asset version for cache-busting in HTML templates
  const assetVersion = process.env.ASSET_VERSION || String(Math.floor(Date.now() / 1000));

  if (trustProxyInput === 'loopback' || trustProxyInput === 'true') {
    trustProxy = 'loopback';
  } else if (trustProxyInput === 'false' || trustProxyInput === '') {
    trustProxy = false;
  } else if (/^\d+$/.test(trustProxyInput)) {
    trustProxy = Number(trustProxyInput);
  } else if (trustProxyInput) {
    trustProxy = trustProxyInput;
  }

  const uptimeApiKey = process.env.UPTIMEROBOT_API_KEY || '';
  const uptimeMonitorId = process.env.UPTIMEROBOT_MONITOR_ID || '';

  const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [new winston.transports.Console()],
  });

  const app = express();

  authMiddleware(app);

  app.set('trust proxy', trustProxy || 1);

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    // Admin and public UIs are free of inline styles; disallow 'unsafe-inline' for style-src
    const styleSrc = "style-src 'self'";
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",

      "script-src 'self'",

      "connect-src 'self' data: https://api.uptimerobot.com",

      "img-src 'self' data:",

      styleSrc,

      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      'report-to csp-endpoint',
      'report-uri /csp-report',
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
    // Additional security headers not covered by helmet defaults
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Report-To',
      JSON.stringify({
        group: 'csp-endpoint',
        max_age: 10886400,
        endpoints: [{ url: '/csp-report' }],
      })
    );

    next();
  });

  // Small helper to fetch with timeout and a consistent UA
  async function fetchWithTimeout(
    url,
    { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, headers = {}, ...opts } = {}
  ) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(new Error('timeout')), Math.max(1, timeoutMs));
    try {
      const ua = `PoGoSDex/1.0 (+https://github.com/weIlThought/PoGoSDex)`;
      const res = await fetch(url, {
        ...opts,
        headers: { 'User-Agent': ua, ...headers },
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  // Shared UptimeRobot request helper
  async function requestUptimeRobot({ apiKey, monitorId, ratios = '1-7-30', validate = true }) {
    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('format', 'json');
    params.append('logs', '0');
    params.append('custom_uptime_ratios', ratios);
    if (monitorId) params.append('monitors', monitorId);

    const response = await fetchWithTimeout('https://api.uptimerobot.com/v2/getMonitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params,
    });
    if (!response.ok) throw new Error(`UptimeRobot HTTP ${response.status}`);
    const json = await response.json();
    if (validate) {
      if (!json || json.stat !== 'ok' || !Array.isArray(json.monitors)) {
        throw new Error('Invalid UptimeRobot payload');
      }
    }
    return json;
  }

  // Version routes are registered via routes/public.js

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  if (process.env.NODE_ENV === 'production' && allowedOrigin === '*') {
    logger.warn('[security] CORS origin is * in production. Set ALLOWED_ORIGIN to your domain.');
  }
  app.use(
    cors({
      origin: allowedOrigin === '*' ? true : allowedOrigin.split(','),
      credentials: true,
      maxAge: 86400,
    })
  );
  app.use(compression());
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
      skip: () => isTest,
    })
  );

  if (!isTest) {
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
  }

  if (!isTest) {
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
      const ua = req.get('user-agent') || '';
      if (!ua || /curl|wget|python|scrapy|httpclient|httpx/i.test(ua)) {
        return res.status(403).send('Forbidden');
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
        return res.status(429).send('Too many requests');
      }
      next();
    });
  }

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Stricter rate limiting for login endpoint
  const loginLimiter = rateLimit({
    windowMs: RATE_LIMIT.LOGIN.WINDOW_MS,
    limit: RATE_LIMIT.LOGIN.MAX_ATTEMPTS,
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
  });
  app.post('/admin/login', loginLimiter, async (req, res) => {
    try {
      await handleLogin(req, res);
    } catch (e) {
      res.status(500).json({ error: 'Login failed' });
    }
  });
  app.post('/admin/logout', requireAuth, (req, res) => {
    try {
      handleLogout(req, res);
    } catch {
      res.json({ ok: true });
    }
  });
  app.get('/admin/me', requireAuth, meHandler);

  app.get('/healthz', async (_req, res) => {
    try {
      const p = getPool();
      await p.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const p = getPool();
      await p.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  // Uptime routes are registered via routes/status.js

  const distRoot = path.resolve(__dirname, '..', 'dist');
  const publicRoot = path.resolve(__dirname, '..', 'public');
  let staticRoot = publicRoot;
  try {
    await fs.promises.access(path.join(distRoot, 'index.html'), fs.constants.R_OK);
    staticRoot = distRoot; // bevorzugt dist/, wenn vorhanden
  } catch {}
  const htmlCache = new Map();
  const fsp = fs.promises;
  await Promise.all(
    htmlRoutes.map(async ({ file }) => {
      const fullPath = path.join(staticRoot, file);
      const content = await fsp.readFile(fullPath, 'utf8');
      htmlCache.set(file, content);
    })
  );

  app.use(
    express.static(staticRoot, {
      index: false,
      extensions: ['html'],
      etag: true,
      maxAge: '12h',
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=43200, immutable');
      },
    })
  );

  const adminDir = path.join(__dirname, 'admin');
  app.get('/login.html', async (req, res) => {
    try {
      const file = path.join(adminDir, 'login.html');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });

  app.get('/login.js', async (req, res) => {
    try {
      const file = path.join(adminDir, 'login.js');
      res.type('application/javascript');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });
  app.get('/admin.html', requireAuth, async (req, res) => {
    try {
      const file = path.join(adminDir, 'admin.html');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });
  app.get('/admin.js', requireAuth, async (req, res) => {
    try {
      const file = path.join(adminDir, 'admin.js');
      res.type('application/javascript');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });

  app.get('/admin.css', async (req, res) => {
    try {
      const file = path.join(adminDir, 'admin.css');
      res.type('text/css');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });

  // Optional Admin-Overrides stylesheet (served from server/admin/admin-override.css)
  app.get('/admin-override.css', async (req, res) => {
    try {
      const file = path.join(adminDir, 'admin-override.css');
      res.type('text/css');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(file);
    } catch {
      res.status(404).send('Not found');
    }
  });

  app.use(
    '/lang',
    express.static(path.resolve(__dirname, '..', 'lang'), {
      index: false,
      maxAge: '1h',
    })
  );

  logger.info(`[startup] staticRoot=${staticRoot}`);
  try {
    await fsp.access(path.join(staticRoot, 'index.html'), fs.constants.R_OK);
    logger.info('[startup] index.html found in staticRoot');
  } catch (err) {
    logger.warn('[startup] index.html NOT found in staticRoot - this may cause GET / to 404');
  }

  for (const { route, file } of htmlRoutes) {
    app.get(route, async (req, res) => {
      const content = htmlCache.get(file);
      if (!content) {
        return res.status(404).send('Not found');
      }

      try {
        const dnt = (req.get('dnt') || req.get('DNT') || '').toString() === '1';
        const cookiesHeader = req.get('cookie') || '';
        const optout = /(^|;\s*)analytics_optout=(true|1)/i.test(cookiesHeader);
        if (!dnt && !optout) {
          const p = getPool();
          await p.execute(
            'INSERT INTO visitors (day, hits) VALUES (CURRENT_DATE(), 1) ON DUPLICATE KEY UPDATE hits = hits + 1'
          );

          const ua = req.get('user-agent') || '';
          const ip = req.ip || '';
          const salt = process.env.ANALYTICS_SALT || process.env.SESSION_SALT || 'pgsdex';
          const today = new Date().toISOString().slice(0, 10);
          const raw = `${salt}|${ip}|${ua}|${today}`;
          const h = crypto.createHash('sha256').update(raw).digest('hex');
          await p.execute(
            'INSERT IGNORE INTO visitor_sessions (day, hash) VALUES (CURRENT_DATE(), ?)',
            [h]
          );
        }
      } catch (e) {}

      let out = content
        .replace(/{{CSP_NONCE}}/g, res.locals.cspNonce || '')
        .replace(/{{ASSET_VERSION}}/g, assetVersion);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(out);
    });
  }

  const parsePagination = (req) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const q = (req.query.q || '').toString().trim() || undefined;
    return { limit, offset, q };
  };

  const { listDevices, countDevices, getDevice, createDevice, updateDevice, deleteDevice } =
    await import('./repositories/devices.js');
  const { listNews, countNews, getNews, createNews, updateNews, deleteNews } = await import(
    './repositories/news.js'
  );
  const { listCoords, countCoords, getCoord, createCoord, updateCoord, deleteCoord } = await import(
    './repositories/coords.js'
  );
  const { listIssues, countIssues, getIssue, createIssue, updateIssue, deleteIssue } = await import(
    './repositories/issues.js'
  );
  const {
    createDeviceProposal,
    listDeviceProposals,
    countDeviceProposals,
    getDeviceProposal,
    approveDeviceProposal,
    rejectDeviceProposal,
  } = await import('./repositories/proposals.js');

  // Register modularized routes
  const { registerPublicRoutes } = await import('./routes/public.js');
  const { registerAdminRoutes } = await import('./routes/admin.js');
  const { registerStatusRoutes } = await import('./routes/status.js');

  registerPublicRoutes(app, {
    isTest,
    parsePagination,
    fetchWithTimeout,
    getPgsharpVersionCached,
    getPokeminersVersionCached,
    repos: {
      devices: { listDevices },
      news: { listNews },
      coords: { listCoords },
      issues: { listIssues },
      proposals: { createDeviceProposal },
    },
  });

  registerAdminRoutes(app, {
    requireAuth,
    requireCsrf,
    parsePagination,
    validators: {
      validateDevicePayload,
      validateNewsPayload,
      validateCoordPayload,
      validateIssuePayload,
    },
    repos: {
      devices: { listDevices, countDevices, createDevice, updateDevice, deleteDevice },
      news: { listNews, countNews, updateNews, deleteNews, createNews },
      coords: { listCoords, countCoords, getCoord, createCoord, updateCoord, deleteCoord },
      issues: { listIssues, countIssues, getIssue, createIssue, updateIssue, deleteIssue },
      proposals: {
        listDeviceProposals,
        countDeviceProposals,
        getDeviceProposal,
        approveDeviceProposal,
        rejectDeviceProposal,
      },
    },
    getPool,
  });

  registerStatusRoutes(app, {
    uptimeApiKey,
    uptimeMonitorId,
    requestUptimeRobot,
  });

  // Public routes are registered via routes/public.js

  // Admin routes are registered via routes/admin.js

  if (!isTest) {
    schedulePgsharpAutoRefresh(logger);
    schedulePokeminersAutoRefresh(logger);
  }
  return { app, port, logger };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Global error handlers for unhandled rejections and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // In production, consider graceful shutdown or alerting
    if (process.env.NODE_ENV === 'production') {
      // Log to monitoring service, then optionally exit
      console.error('Unhandled rejection in production - consider investigating');
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Uncaught exceptions leave the process in an undefined state
    // It's best practice to exit and let process manager restart
    console.error('Process will exit due to uncaught exception');
    process.exit(1);
  });

  createServer()
    .then(({ app, port, logger }) => {
      app.listen(port, () => {
        logger.info(`✅ Server running on port ${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}
