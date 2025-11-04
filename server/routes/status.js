import crypto from 'crypto';

const uptimeCache = {
  payload: null,
  timestamp: 0,
};

export function registerStatusRoutes(app, deps) {
  const { uptimeApiKey, uptimeMonitorId, requestUptimeRobot } = deps;

  app.get('/status/uptime', async (req, res) => {
    if (!uptimeApiKey) {
      return res.status(501).json({ error: 'Uptime monitoring not configured' });
    }

    const now = Date.now();
    if (uptimeCache.payload && now - uptimeCache.timestamp < 3 * 60 * 1000) {
      const body = JSON.stringify(uptimeCache.payload);
      const etag = `W/"${crypto.createHash('sha1').update(body).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      if (uptimeCache.timestamp) {
        res.setHeader('Last-Modified', new Date(uptimeCache.timestamp).toUTCString());
      }
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      return res.type('application/json').send(body);
    }

    try {
      const json = await requestUptimeRobot({ apiKey: uptimeApiKey, monitorId: uptimeMonitorId });

      if (!json.monitors.length) {
        const payload = { state: 'unknown', statusCode: null, uptimeRatio: null, checkedAt: null };
        uptimeCache.payload = payload;
        uptimeCache.timestamp = now;
        const body = JSON.stringify(payload);
        const etag = `W/"${crypto.createHash('sha1').update(body).digest('hex')}"`;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
        res.setHeader('Last-Modified', new Date(uptimeCache.timestamp).toUTCString());
        const inm = req.get('if-none-match') || '';
        if (inm.includes(etag)) return res.status(304).end();
        return res.type('application/json').send(body);
      }

      const monitor = json.monitors[0];
      const statusCode = Number(monitor.status);

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

      const body = JSON.stringify(payload);
      const etag = `W/"${crypto.createHash('sha1').update(body).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      res.setHeader('Last-Modified', new Date(uptimeCache.timestamp).toUTCString());
      const inm = req.get('if-none-match') || '';
      if (inm.includes(etag)) return res.status(304).end();
      return res.type('application/json').send(body);
    } catch (error) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'Failed to fetch uptime status' });
    }
  });

  app.get('/api/uptime', async (req, res) => {
    try {
      const data = await requestUptimeRobot({
        apiKey: uptimeApiKey,
        monitorId: uptimeMonitorId,
        validate: false,
      });
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
}
