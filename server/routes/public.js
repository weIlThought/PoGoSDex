import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { sanitizeError } from '../utils/errors.js';

export function registerPublicRoutes(app, deps) {
  const {
    isTest,
    parsePagination,
    fetchWithTimeout,
    getPgsharpVersionCached,
    getPokeminersVersionCached,
    repos,
  } = deps;

  const {
    devices: { listDevices },
    news: { listNews },
    coords: { listCoords },
    issues: { listIssues },
    proposals: { createDeviceProposal },
  } = repos;

  // Version endpoints
  app.get('/api/pgsharp/version', async (req, res) => {
    try {
      const result = await getPgsharpVersionCached();
      res.json(result);
    } catch (e) {
      const message = sanitizeError(e, 'Failed to fetch PGSharp version');
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get('/api/pokeminers/version', async (_req, res) => {
    try {
      const result = await getPokeminersVersionCached();
      res.json(result);
    } catch (e) {
      const message = sanitizeError(e, 'Failed to fetch Pokeminers version');
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Public devices
  app.get('/api/devices', async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const rows = await listDevices({ q, limit: Math.min(200, limit), offset });
      const items = rows.map((r) => ({
        id: r.id,
        model: r.model || r.name || '',
        brand: r.brand || '',
        type: r.type || '',
        os: r.os || '',
        compatible: !!r.compatible,
        notes: Array.isArray(r.notes) ? r.notes : r.notes ? [r.notes] : [],
        rootLinks: Array.isArray(r.root_links) ? r.root_links : r.root_links ? [r.root_links] : [],
        priceRange: r.price_range || null,
        pogo: r.pogo_comp || null,
        pgsharp: null,
      }));
      const payload = JSON.stringify(items);
      const etag = `W/"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      res.type('application/json').send(payload);
    } catch (e) {
      console.error('[api] public devices failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  // Public news
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
      const payload = JSON.stringify(items);
      const etag = `W/"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      res.type('application/json').send(payload);
    } catch (e) {
      console.error('[api] public news failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  // Public issues
  app.get('/api/issues', async (req, res) => {
    try {
      const q = (req.query.q || '').toString().trim() || undefined;
      const statusQuery = (req.query.status || '').toString().trim();
      let statuses = undefined;
      if (statusQuery) {
        statuses = statusQuery;
      }
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const offset = Math.max(0, Number(req.query.offset || 0));

      const items = await listIssues({ q, status: statuses, limit, offset });
      const out = items.map((it) => ({
        id: it.id,
        title: it.title,
        content: it.content || '',
        status: it.status || 'open',
        tags: Array.isArray(it.tags) ? it.tags : it.tags ? [it.tags] : [],
        createdAt: it.created_at || null,
        updatedAt: it.updated_at || null,
      }));
      const payload = JSON.stringify(out);
      const etag = `W/"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      res.type('application/json').send(payload);
    } catch (e) {
      console.error('[api] public issues failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  // Public coords
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
      const payload = JSON.stringify(items);
      const etag = `W/"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      res.type('application/json').send(payload);
    } catch (e) {
      console.error('[api] public coords failed:', e && e.message ? e.message : e);
      res.status(500).json([]);
    }
  });

  // Public: Device proposals
  if (!isTest) {
    const proposalLimiterShort = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5 });
    const proposalLimiterDay = rateLimit({ windowMs: 24 * 60 * 60 * 1000, limit: 50 });
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

          if (typeof hp === 'string' && hp.trim() !== '') {
            return res.status(200).json({ ok: true });
          }
          if (process.env.TURNSTILE_SECRET) {
            if (!cfTurnstileToken || typeof cfTurnstileToken !== 'string') {
              return res.status(400).json({ error: 'captcha required' });
            }
            try {
              const verifyRes = await fetchWithTimeout(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                  },
                  body: new URLSearchParams({
                    secret: process.env.TURNSTILE_SECRET,
                    response: cfTurnstileToken,
                    remoteip: req.ip || '',
                  }),
                  timeoutMs: 5000,
                }
              );
              const verifyJson = await verifyRes.json();
              if (!verifyJson.success) return res.status(400).json({ error: 'captcha failed' });
            } catch {
              return res.status(400).json({ error: 'captcha verify error' });
            }
          }

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
    app.post('/api/device-proposals', async (req, res) => {
      try {
        const created = await createDeviceProposal(req.body || {});
        res.status(201).json({ ok: true, id: created.id });
      } catch (e) {
        res.status(400).json({ error: 'invalid payload' });
      }
    });
  }
}
