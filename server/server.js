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
import { initDB } from './db.js';
import { migrate, seedAdminIfNeeded } from './mysql.js';
import {
  authMiddleware,
  handleLogin,
  handleLogout,
  requireAuth,
  requireCsrf,
  meHandler,
} from './auth.js';
import { validateData } from './validate-data.js';
import fetch from 'node-fetch';

import {
  getPokeminersVersionCached,
  schedulePokeminersAutoRefresh,
} from './scrapers/pokeminers.js';
import { getPgsharpVersionCached, schedulePgsharpAutoRefresh } from './scrapers/pgsharp.js';

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
  const port = Number(process.env.PORT || 3000);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  const trustProxyInput = (process.env.TRUST_PROXY || '').trim().toLowerCase();
  let trustProxy = false;
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

  // Skip heavy startup routines during tests
  if (!isTest) {
    await initDB();
    // Initialize MySQL schema and seed admin if configured
    try {
      await migrate();
    } catch (e) {
      logger && logger.error && logger.error(`❌ MySQL migration failed: ${String(e)}`);
    }
    try {
      await seedAdminIfNeeded(logger);
    } catch (e) {
      logger && logger.warn && logger.warn(`⚠️ Admin seed skipped: ${String(e)}`);
    }
    await validateData(logger);
  }

  const app = express();
  // Auth cookie parser
  authMiddleware(app);

  app.set('trust proxy', trustProxy || 1);

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      // Allow scripts from self and jsDelivr CDN (for DOMPurify)
      "script-src 'self' https://cdn.jsdelivr.net",
      // Allow API calls to self and UptimeRobot; include jsDelivr for optional sourcemap requests in DevTools
      "connect-src 'self' data: https://api.uptimerobot.com https://cdn.jsdelivr.net",
      // Allow images from self and data URLs
      "img-src 'self' data:",
      // Allow styles from self and HTTPS (includes Google Fonts CSS); keep inline styles for minimal runtime style injection
      "style-src 'self' 'unsafe-inline' https:",
      // Explicitly allow font files from Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com data:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      'report-to csp-endpoint',
      'report-uri /csp-report',
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
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

  app.get('/api/pgsharp/version', async (req, res) => {
    try {
      const result = await getPgsharpVersionCached();
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  app.get('/api/pokeminers/version', async (_req, res) => {
    try {
      const result = await getPokeminersVersionCached();
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

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
      skip: () => isTest, // keep test output clean
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

  // --- Auth routes ---
  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
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

  app.get('/status/uptime', async (_req, res) => {
    if (!uptimeApiKey) {
      return res.status(501).json({ error: 'Uptime monitoring not configured' });
    }

    const now = Date.now();
    if (uptimeCache.payload && now - uptimeCache.timestamp < 3 * 60 * 1000) {
      return res.json(uptimeCache.payload);
    }

    try {
      const params = new URLSearchParams();
      params.append('api_key', uptimeApiKey);
      params.append('format', 'json');
      params.append('logs', '0');
      params.append('custom_uptime_ratios', '1-7-30');
      if (uptimeMonitorId) {
        // If a specific monitor is configured, request only that monitor
        params.append('monitors', uptimeMonitorId);
      }

      const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!response.ok) {
        throw new Error(`UptimeRobot HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.stat !== 'ok' || !Array.isArray(json.monitors)) {
        throw new Error('Invalid UptimeRobot payload');
      }

      if (!json.monitors.length) {
        // No monitor found (e.g., wrong monitor ID). Return graceful unknown state.
        const payload = { state: 'unknown', statusCode: null, uptimeRatio: null, checkedAt: null };
        uptimeCache.payload = payload;
        uptimeCache.timestamp = now;
        return res.json(payload);
      }

      const monitor = json.monitors[0];
      const statusCode = Number(monitor.status);
      // Prefer all-time uptime; fallback to custom ratios (we requested 1-7-30, last is 30d)
      let uptimeRatio = Number(monitor.all_time_uptime_ratio);
      if (!Number.isFinite(uptimeRatio) && typeof monitor.custom_uptime_ratio === 'string') {
        const parts = monitor.custom_uptime_ratio
          .split('-')
          .map((s) => parseFloat(String(s).trim()))
          .filter((n) => Number.isFinite(n));
        if (parts.length) {
          uptimeRatio = parts[parts.length - 1];
        }
      }

      let state = 'unknown';
      // Mapping gemäß Tests: 2 -> up, 9 -> degraded, 0/1/8 -> down
      if (statusCode === 2) state = 'up';
      else if (statusCode === 9) state = 'degraded';
      else if ([0, 1, 8].includes(statusCode)) state = 'down';

      const payload = {
        state,
        statusCode,
        uptimeRatio: Number.isFinite(uptimeRatio) ? uptimeRatio : null,
        checkedAt: monitor.create_datetime ? monitor.create_datetime * 1000 : null,
      };

      uptimeCache.payload = payload;
      uptimeCache.timestamp = now;

      return res.json(payload);
    } catch (error) {
      return res.status(502).json({ error: 'Failed to fetch uptime status' });
    }
  });

  app.get('/api/uptime', async (req, res) => {
    try {
      const apiKey = process.env.UPTIMEROBOT_API_KEY;
      const monitorID = '801563784';
      const response = await fetch(`https://api.uptimerobot.com/v2/getMonitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `api_key=${apiKey}&monitors=${monitorID}&format=json`,
      });
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

  const staticRoot = path.resolve(__dirname, '..', 'public');
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

  // --- Admin frontend (served from private folder, auth required) ---
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
  // Public login JS (no auth required)
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
  // CSS kann öffentlich ausgeliefert werden (enthält keine geheimen Daten)
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

  app.get('/data/coords.json', (req, res) => {
    const coordsPath = path.join(__dirname, '..', 'data', 'coords.json');
    res.type('application/json');
    res.sendFile(coordsPath, (err) => {
      if (err) {
        logger && logger.error
          ? logger.error(`❌ Fehler beim Senden der coords.json: ${String(err)}`)
          : console.error('❌ Fehler beim Senden der coords.json:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'coords.json not found' });
        } else {
          try {
            res.end();
          } catch (err) {
            // ignore failed end calls
            void err;
          }
        }
      } else {
        // Use the structured logger for startup/info messages
        logger &&
          typeof logger.info === 'function' &&
          logger.info(`📡 Coords-Datei ausgeliefert: ${coordsPath}`);
      }
    });
  });

  app.use(
    '/data',
    express.static(path.resolve(__dirname, '..', 'data'), {
      index: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      },
    })
  );

  app.use(
    '/lang',
    express.static(path.resolve(__dirname, '..', 'lang'), {
      index: false,
      maxAge: '1h',
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

  app.use(
    '/data',
    express.static(path.resolve(__dirname, '..', 'data'), {
      index: false,
      maxAge: '1h',
    })
  );

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
    app.get(route, (req, res) => {
      const content = htmlCache.get(file);
      if (!content) {
        return res.status(404).send('Not found');
      }

      let out = content
        .replace(/{{CSP_NONCE}}/g, res.locals.cspNonce || '')
        .replace(/{{ASSET_VERSION}}/g, assetVersion);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Prevent caching of HTML documents to ensure fresh template placeholders and assets
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(out);
    });
  }

  // --- Admin API (protected, JSON) ---
  const parsePagination = (req) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const q = (req.query.q || '').toString().trim() || undefined;
    return { limit, offset, q };
  };

  const { listDevices, getDevice, createDevice, updateDevice, deleteDevice } = await import(
    './repositories.js'
  );
  const { listNews, getNews, createNews, updateNews, deleteNews } = await import(
    './repositories.js'
  );

  // Devices
  app.get('/admin/api/devices', requireAuth, async (req, res) => {
    try {
      const rows = await listDevices(parsePagination(req));
      res.json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list devices' });
    }
  });
  app.post('/admin/api/devices', requireAuth, requireCsrf, async (req, res) => {
    const { name, description, image_url, status } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    try {
      const created = await createDevice({ name: name.trim(), description, image_url, status });
      res.status(201).json(created);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create device' });
    }
  });
  app.put('/admin/api/devices/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const updated = await updateDevice(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update device' });
    }
  });
  app.delete('/admin/api/devices/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const ok = await deleteDevice(id);
      if (!ok) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete device' });
    }
  });

  // News
  app.get('/admin/api/news', requireAuth, async (req, res) => {
    try {
      const rows = await listNews(parsePagination(req));
      res.json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list news' });
    }
  });
  app.post('/admin/api/news', requireAuth, requireCsrf, async (req, res) => {
    const { title, content, image_url, published } = req.body || {};
    if (!title || typeof title !== 'string')
      return res.status(400).json({ error: 'title required' });
    if (!content || typeof content !== 'string')
      return res.status(400).json({ error: 'content required' });
    try {
      const created = await createNews({ title: title.trim(), content, image_url, published });
      res.status(201).json(created);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create news' });
    }
  });
  app.put('/admin/api/news/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const updated = await updateNews(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update news' });
    }
  });
  app.delete('/admin/api/news/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const ok = await deleteNews(id);
      if (!ok) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete news' });
    }
  });

  app.use((req, res, next) => {
    if (req.path === '/data/coords.json') {
      logger.info(
        `[coords-request] ${req.ip} ${req.method} ${req.path} headers=${JSON.stringify(
          req.headers && { accept: req.get('accept') }
        )}`
      );
    }
    next();
  });
  if (!isTest) {
    schedulePgsharpAutoRefresh(logger);
    schedulePokeminersAutoRefresh(logger);
  }
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
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}
