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

  // Lightweight health endpoint to check DB connectivity (no secrets)
  app.get('/healthz', async (_req, res) => {
    try {
      const p = getPool();
      await p.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });
  // Public alias for healthcheck under /api as well (some proxies whitelist /api/*)
  app.get('/api/health', async (_req, res) => {
    try {
      const p = getPool();
      await p.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

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

  // Entfernt: Früherer statischer /data Endpunkt (Coords) wird nicht mehr benötigt,
  // da Frontend ausschließlich DB-gestützte APIs unter /api nutzt.

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

  // Hinweis: /lang wird bereits weiter oben ausgeliefert

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

      // Increment visitor counter for daily stats (best effort, non-blocking)
      try {
        const p = getPool();
        await p.execute(
          'INSERT INTO visitors (day, hits) VALUES (CURRENT_DATE(), 1) ON DUPLICATE KEY UPDATE hits = hits + 1'
        );
      } catch (e) {
        // don't block page rendering on analytics failure
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
  const { listCoords, getCoord, createCoord, updateCoord, deleteCoord } = await import(
    './repositories.js'
  );
  const {
    createDeviceProposal,
    listDeviceProposals,
    getDeviceProposal,
    approveDeviceProposal,
    rejectDeviceProposal,
  } = await import('./repositories.js');

  // --- Öffentliche API (read-only, keine Auth) ---
  // Normalisiert Felder auf camelCase, filtert sensible/unveröffentlichte Inhalte heraus
  app.get('/api/devices', async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const rows = await listDevices({ q, limit: Math.min(200, limit), offset });
      const items = rows.map((r) => ({
        id: r.id,
        // bevorzugt Modellnamen, fällt auf name zurück
        model: r.model || r.name || '',
        brand: r.brand || '',
        type: r.type || '',
        os: r.os || '',
        compatible: !!r.compatible,
        notes: Array.isArray(r.notes) ? r.notes : r.notes ? [r.notes] : [],
        rootLinks: Array.isArray(r.root_links) ? r.root_links : r.root_links ? [r.root_links] : [],
        priceRange: r.price_range || null,
        // Zusammenfassung, damit das Frontend weiterhin "PoGO Compatibility" darstellen kann
        pogo: r.pogo_comp || null,
        pgsharp: null,
      }));
      res.json(items);
    } catch (e) {
      console.error('[api] public devices failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  app.get('/api/news', async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const rows = await listNews({ q, limit: Math.min(200, limit), offset });
      const published = rows.filter((n) => Number(n.published) === 1);
      const items = published.map((n) => ({
        id: n.id,
        slug: n.slug || null,
        date: n.date || null,
        title: n.title,
        excerpt: n.excerpt || null,
        content: n.content || '',
        tags: Array.isArray(n.tags) ? n.tags : n.tags ? [n.tags] : [],
        publishedAt: n.published_at || null,
        updatedAt: n.updated_at_ext || null,
      }));
      res.json(items);
    } catch (e) {
      console.error('[api] public news failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  app.get('/api/coords', async (req, res) => {
    try {
      const q = (req.query.q || '').toString().trim() || undefined;
      const category = (req.query.category || '').toString().trim() || undefined;
      const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
      const offset = Math.max(0, Number(req.query.offset || 0));
      const rows = await listCoords({ q, category, limit, offset });
      const items = rows.map((r) => ({
        id: r.id,
        category: r.category,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        note: r.note || null,
        tags: Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : [],
      }));
      res.json(items);
    } catch (e) {
      console.error('[api] public coords failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  // Public: Neue Geräte-Vorschläge einreichen (mit Rate-Limits, Honeypot, optional Captcha)
  if (!isTest) {
    const proposalLimiterShort = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5 }); // 5 / 10min
    const proposalLimiterDay = rateLimit({ windowMs: 24 * 60 * 60 * 1000, limit: 50 }); // 50 / Tag
    app.post(
      '/api/device-proposals',
      proposalLimiterShort,
      proposalLimiterDay,
      async (req, res) => {
        try {
          const {
            brand,
            model,
            os,
            type,
            compatible,
            priceRange,
            pogo,
            manufacturerUrl,
            notes,
            rootLinks,
            hp,
            cfTurnstileToken,
          } = req.body || {};
          // Honeypot: ruhig ignorieren, wenn gefüllt
          if (typeof hp === 'string' && hp.trim() !== '') {
            return res.status(200).json({ ok: true });
          }
          // Optional: Cloudflare Turnstile
          if (process.env.TURNSTILE_SECRET) {
            if (!cfTurnstileToken || typeof cfTurnstileToken !== 'string') {
              return res.status(400).json({ error: 'captcha required' });
            }
            try {
              const verifyRes = await fetch(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    secret: process.env.TURNSTILE_SECRET,
                    response: cfTurnstileToken,
                    remoteip: req.ip || '',
                  }),
                }
              );
              const verifyJson = await verifyRes.json();
              if (!verifyJson.success) return res.status(400).json({ error: 'captcha failed' });
            } catch {
              return res.status(400).json({ error: 'captcha verify error' });
            }
          }
          // Minimalvalidierung
          if (!model || typeof model !== 'string' || model.trim().length < 2) {
            return res.status(400).json({ error: 'model required' });
          }
          const created = await createDeviceProposal({
            brand,
            model: model.trim(),
            os,
            type,
            compatible: !!compatible,
            price_range: priceRange,
            pogo_comp: pogo,
            manufacturer_url: manufacturerUrl,
            notes: Array.isArray(notes)
              ? notes
              : typeof notes === 'string'
              ? notes
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            root_links: Array.isArray(rootLinks)
              ? rootLinks
              : typeof rootLinks === 'string'
              ? rootLinks
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
          });
          res.status(201).json({ ok: true, id: created.id });
        } catch (e) {
          res.status(400).json({ error: 'invalid payload' });
        }
      }
    );
  } else {
    // Tests: kein Ratelimit
    app.post('/api/device-proposals', async (req, res) => {
      try {
        const created = await createDeviceProposal(req.body || {});
        res.status(201).json({ ok: true, id: created.id });
      } catch (e) {
        res.status(400).json({ error: 'invalid payload' });
      }
    });
  }

  // Devices
  app.get('/admin/api/devices', requireAuth, async (req, res) => {
    try {
      const rows = await listDevices(parsePagination(req));
      res.json({ items: rows });
    } catch (e) {
      console.error('[api] listDevices failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to list devices' });
    }
  });
  app.post('/admin/api/devices', requireAuth, requireCsrf, async (req, res) => {
    const {
      name,
      description,
      image_url,
      status,
      model,
      brand,
      type,
      os,
      compatible,
      notes,
      manufacturer_url,
      root_links,
      price_range,
      pogo_comp,
    } = req.body || {};
    // Require at least model (preferred) or name
    const deviceName =
      name && typeof name === 'string' ? name.trim() : model && String(model).trim();
    if (!deviceName) return res.status(400).json({ error: 'model or name required' });
    try {
      const created = await createDevice({
        name: deviceName,
        description,
        image_url,
        status,
        model,
        brand,
        type,
        os,
        compatible,
        notes,
        manufacturer_url,
        root_links,
        price_range,
        pogo_comp,
      });
      res.status(201).json(created);
    } catch (e) {
      console.error('[api] createDevice failed:', e && e.message ? e.message : e);
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
      console.error('[api] updateDevice failed:', e && e.message ? e.message : e);
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
      console.error('[api] deleteDevice failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  });

  // News
  app.get('/admin/api/news', requireAuth, async (req, res) => {
    try {
      const rows = await listNews(parsePagination(req));
      res.json({ items: rows });
    } catch (e) {
      console.error('[api] listNews failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to list news' });
    }
  });
  app.post('/admin/api/news', requireAuth, requireCsrf, async (req, res) => {
    const {
      id: slug,
      slug: slugAlt,
      date,
      title,
      excerpt,
      content,
      image_url,
      published,
      publishedAt,
      updatedAt,
      tags,
    } = req.body || {};
    if (!title || typeof title !== 'string')
      return res.status(400).json({ error: 'title required' });
    if (!content || typeof content !== 'string')
      return res.status(400).json({ error: 'content required' });
    try {
      const created = await createNews({
        slug: slugAlt || slug || null,
        date: date || null,
        title: title.trim(),
        excerpt: excerpt || null,
        content,
        image_url: image_url || null,
        published,
        published_at: publishedAt || null,
        updated_at_ext: updatedAt || null,
        tags,
      });
      res.status(201).json(created);
    } catch (e) {
      console.error('[api] createNews failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to create news' });
    }
  });
  app.put('/admin/api/news/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const {
        id: slug,
        slug: slugAlt,
        date,
        title,
        excerpt,
        content,
        image_url,
        published,
        publishedAt,
        updatedAt,
        tags,
      } = req.body || {};
      const updated = await updateNews(id, {
        slug: slugAlt || slug,
        date,
        title,
        excerpt,
        content,
        image_url,
        published,
        published_at: publishedAt,
        updated_at_ext: updatedAt,
        tags,
      });
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      console.error('[api] updateNews failed:', e && e.message ? e.message : e);
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
      console.error('[api] deleteNews failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to delete news' });
    }
  });

  // Coords
  app.get('/admin/api/coords', requireAuth, async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const category = (req.query.category || '').toString().trim() || undefined;
      const rows = await listCoords({ q, category, limit, offset });
      res.json({ items: rows });
    } catch (e) {
      console.error('[api] listCoords failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to list coords' });
    }
  });
  app.get('/admin/api/coords/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const row = await getCoord(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(row);
    } catch (e) {
      console.error('[api] getCoord failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to get coord' });
    }
  });

  // --- Overview (admin) ---
  app.get('/admin/api/overview', requireAuth, async (req, res) => {
    // range: 1d|7d|30d|custom, optional from,to (YYYY-MM-DD)
    const range = (req.query.range || '7d').toString();
    const today = new Date();
    const to = req.query.to || today.toISOString().slice(0, 10);
    let from = req.query.from || null;
    if (!from) {
      const match = range.match(/^(\d+)d$/);
      const days = match ? Math.max(1, Math.min(365, Number(match[1]) || 7)) : 7;
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (days - 1));
      from = d.toISOString().slice(0, 10);
    }
    try {
      const p = getPool();
      const [rows] = await p.execute(
        'SELECT day, hits FROM visitors WHERE day BETWEEN ? AND ? ORDER BY day ASC',
        [from, to]
      );
      const total = rows.reduce((s, r) => s + Number(r.hits || 0), 0);
      res.json({ range: { from, to }, total, byDay: rows });
    } catch (e) {
      console.error('[api] overview failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to load overview' });
    }
  });
  app.post('/admin/api/coords', requireAuth, requireCsrf, async (req, res) => {
    const { category = 'top10', name, lat, lng, note, tags } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
      return res.status(400).json({ error: 'lat/lng required' });
    if (!['top10', 'notable', 'raid_spots'].includes(category))
      return res.status(400).json({ error: 'invalid category' });
    try {
      const created = await createCoord({ category, name: name.trim(), lat, lng, note, tags });
      res.status(201).json(created);
    } catch (e) {
      console.error('[api] createCoord failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to create coord' });
    }
  });
  app.put('/admin/api/coords/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const updated = await updateCoord(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      console.error('[api] updateCoord failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to update coord' });
    }
  });
  app.delete('/admin/api/coords/:id', requireAuth, requireCsrf, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const ok = await deleteCoord(id);
      if (!ok) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[api] deleteCoord failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to delete coord' });
    }
  });

  // --- Admin: Device Proposals ---
  app.get('/admin/api/proposals', requireAuth, async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const status = (req.query.status || '').toString().trim() || undefined;
      const items = await listDeviceProposals({ status, q, limit, offset });
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list proposals' });
    }
  });
  app.get('/admin/api/proposals/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const row = await getDeviceProposal(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: 'Failed to get proposal' });
    }
  });
  app.post('/admin/api/proposals/:id/approve', requireAuth, requireCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      // Optional: user id aus me
      // hier nicht notwendig, setzen null
      const updated = await approveDeviceProposal(id, null);
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to approve proposal' });
    }
  });
  app.post('/admin/api/proposals/:id/reject', requireAuth, requireCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const updated = await rejectDeviceProposal(id, null);
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to reject proposal' });
    }
  });

  // Entfernt: Logging für /data/coords.json ist obsolet
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
