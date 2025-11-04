export function registerAdminRoutes(app, deps) {
  const { requireAuth, requireCsrf, parsePagination, validators, repos, getPool } = deps;

  const {
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
  } = repos;

  const { validateDevicePayload, validateNewsPayload, validateCoordPayload, validateIssuePayload } =
    validators;

  // Devices
  app.get('/admin/api/devices', requireAuth, async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const sortBy = (req.query.sortBy || '').toString();
      const sortDir = (req.query.sortDir || '').toString();
      const [rows, total] = await Promise.all([
        listDevices({ q, limit: Math.min(100, limit + 1), offset, sortBy, sortDir }),
        countDevices({ q }),
      ]);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ items, hasMore, total });
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

    const v = validateDevicePayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
    try {
      const created = await createDevice({
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
    const v = validateDevicePayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
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
      const { q, limit, offset } = parsePagination(req);
      const sortBy = (req.query.sortBy || '').toString();
      const sortDir = (req.query.sortDir || '').toString();
      const [rows, total] = await Promise.all([
        listNews({ q, limit: Math.min(100, limit + 1), offset, sortBy, sortDir }),
        countNews({ q }),
      ]);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ items, hasMore, total });
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
    const v = validateNewsPayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
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
      const v = validateNewsPayload(req.body || {});
      if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
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
      const sortBy = (req.query.sortBy || '').toString();
      const sortDir = (req.query.sortDir || '').toString();
      const [rows, total] = await Promise.all([
        listCoords({ q, category, limit: Math.min(100, limit + 1), offset, sortBy, sortDir }),
        countCoords({ q, category }),
      ]);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ items, hasMore, total });
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
  app.post('/admin/api/coords', requireAuth, requireCsrf, async (req, res) => {
    const { category = 'top10', name, lat, lng, note, tags } = req.body || {};
    const v = validateCoordPayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
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
    const v = validateCoordPayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
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

  // Issues
  app.get('/admin/api/issues', requireAuth, async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const status = (req.query.status || '').toString().trim() || undefined;
      const sortBy = (req.query.sortBy || '').toString();
      const sortDir = (req.query.sortDir || '').toString();
      const [rows, total] = await Promise.all([
        listIssues({ q, status, limit: Math.min(100, limit + 1), offset, sortBy, sortDir }),
        countIssues({ q, status }),
      ]);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ items, hasMore, total });
    } catch (e) {
      console.error('[api] listIssues failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to list issues' });
    }
  });
  app.get('/admin/api/issues/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const row = await getIssue(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(row);
    } catch (e) {
      console.error('[api] getIssue failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to get issue' });
    }
  });
  app.post('/admin/api/issues', requireAuth, requireCsrf, async (req, res) => {
    try {
      const { title, content, status, tags } = req.body || {};
      const v = validateIssuePayload(req.body || {});
      if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
      const created = await createIssue({ title: title.trim(), content, status, tags });
      res.status(201).json(created);
    } catch (e) {
      console.error('[api] createIssue failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to create issue' });
    }
  });
  app.put('/admin/api/issues/:id', requireAuth, requireCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const { title, content, status, tags } = req.body || {};
      const v = validateIssuePayload(req.body || {});
      if (!v.ok) return res.status(400).json({ error: v.errors[0] || 'invalid payload' });
      const updated = await updateIssue(id, { title, content, status, tags });
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e) {
      console.error('[api] updateIssue failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to update issue' });
    }
  });
  app.delete('/admin/api/issues/:id', requireAuth, requireCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
      const ok = await deleteIssue(id);
      if (!ok) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[api] deleteIssue failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to delete issue' });
    }
  });

  // Proposals
  app.get('/admin/api/proposals', requireAuth, async (req, res) => {
    try {
      const { q, limit, offset } = parsePagination(req);
      const status = (req.query.status || '').toString().trim() || undefined;
      const sortBy = (req.query.sortBy || '').toString();
      const sortDir = (req.query.sortDir || '').toString();
      const [rows, total] = await Promise.all([
        listDeviceProposals({
          status,
          q,
          limit: Math.min(100, limit + 1),
          offset,
          sortBy,
          sortDir,
        }),
        countDeviceProposals({ status, q }),
      ]);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ items, hasMore, total });
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

  // Dashboard
  app.get('/admin/api/dashboard', requireAuth, async (_req, res) => {
    try {
      const p = getPool();
      const [[devices], [news], [coords], [issues]] = await Promise.all([
        p.execute('SELECT COUNT(*) AS c FROM devices').then(([r]) => r),
        p.execute('SELECT COUNT(*) AS c FROM news').then(([r]) => r),
        p.execute('SELECT COUNT(*) AS c FROM coords').then(([r]) => r),
        p.execute('SELECT COUNT(*) AS c FROM issues').then(([r]) => r),
      ]);
      const [[visTodayRow], [vis7Row], [vis30Row], [visTotalRow], [visDaysRow]] = await Promise.all(
        [
          p
            .execute('SELECT COALESCE(SUM(hits),0) AS v FROM visitors WHERE day = CURRENT_DATE()')
            .then(([r]) => r),
          p
            .execute(
              'SELECT COALESCE(SUM(hits),0) AS v FROM visitors WHERE day >= (CURRENT_DATE() - INTERVAL 6 DAY)'
            )
            .then(([r]) => r),
          p
            .execute(
              'SELECT COALESCE(SUM(hits),0) AS v FROM visitors WHERE day >= (CURRENT_DATE() - INTERVAL 29 DAY)'
            )
            .then(([r]) => r),
          p.execute('SELECT COALESCE(SUM(hits),0) AS v FROM visitors').then(([r]) => r),
          p.execute('SELECT COUNT(*) AS v FROM visitors').then(([r]) => r),
        ]
      );
      res.json({
        counts: {
          devices: Number(devices.c || 0),
          news: Number(news.c || 0),
          coords: Number(coords.c || 0),
          issues: Number(issues.c || 0),
        },
        visitors: {
          today: Number(visTodayRow.v || 0),
          last7d: Number(vis7Row.v || 0),
          last30d: Number(vis30Row.v || 0),
          totalHits: Number(visTotalRow.v || 0),
          totalDays: Number(visDaysRow.v || 0),
        },
      });
    } catch (e) {
      console.error('[api] dashboard failed:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });
}
