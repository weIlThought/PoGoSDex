import { getPool } from './mysql.js';

const p = () => getPool();

export async function listNews({ q, limit = 50, offset = 0, sortBy, sortDir } = {}) {
  const params = [];
  let sql = `SELECT id, slug, date, title, excerpt, content, image_url, published, published_at, updated_at_ext, tags,
                    created_at, updated_at
             FROM news`;
  if (q) {
    sql += ' WHERE title LIKE ? OR excerpt LIKE ? OR content LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const cols = {
    id: 'id',
    slug: 'slug',
    date: 'date',
    title: 'title',
    published_at: 'published_at',
    updated_at_ext: 'updated_at_ext',
    updated_at: 'updated_at',
    created_at: 'created_at',
  };
  const col = cols[String(sortBy || '').toLowerCase()] || 'updated_at';
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  const parseJson = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v;
  };
  return rows.map((r) => ({ ...r, tags: parseJson(r.tags) }));
}

export async function countNews({ q } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM news';
  if (q) {
    sql += ' WHERE title LIKE ? OR excerpt LIKE ? OR content LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await p().execute(sql, params);
  return Number(rows[0]?.c || 0);
}

export async function getNews(id) {
  const [rows] = await p().execute(
    `SELECT id, slug, date, title, excerpt, content, image_url, published, published_at, updated_at_ext, tags,
            created_at, updated_at
     FROM news WHERE id = ?`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  let tags = null;
  if (r.tags != null) {
    if (typeof r.tags === 'string') {
      try {
        tags = JSON.parse(r.tags);
      } catch {
        tags = null;
      }
    } else {
      tags = r.tags;
    }
  }
  return { ...r, tags };
}

export async function createNews(payload) {
  const {
    slug,
    date,
    title,
    excerpt,
    content,
    image_url,

    published = 0,
    published_at,
    updated_at,
    updated_at_ext,
    tags,
  } = payload || {};
  const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags || null;
  const [res] = await p().execute(
    `INSERT INTO news (slug, date, title, excerpt, content, image_url, published, published_at, updated_at_ext, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug || null,
      date || null,
      title,
      excerpt || null,
      content,
      image_url || null,
      published ? 1 : 0,
      published_at || null,
      updated_at_ext || updated_at || null,
      tagsJson,
    ]
  );
  return await getNews(res.insertId);
}

export async function updateNews(id, payload) {
  const fields = [];
  const params = [];
  const set = (col, val, transform = (x) => x) => {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      params.push(transform(val));
    }
  };
  set('slug', payload.slug);
  set('date', payload.date);
  set('title', payload.title);
  set('excerpt', payload.excerpt);
  set('content', payload.content);
  set('image_url', payload.image_url);
  set('published', payload.published, (v) => (v ? 1 : 0));
  set('published_at', payload.published_at);
  set('updated_at_ext', payload.updated_at_ext ?? payload.updated_at);
  set('tags', payload.tags, (v) => (Array.isArray(v) ? JSON.stringify(v) : v || null));
  if (!fields.length) return await getNews(id);
  params.push(id);
  await p().execute(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, params);
  return await getNews(id);
}

export async function deleteNews(id) {
  const [res] = await p().execute('DELETE FROM news WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function listCoords({ q, category, limit = 50, offset = 0, sortBy, sortDir } = {}) {
  const params = [];
  let sql = 'SELECT id, category, name, lat, lng, note, tags, created_at, updated_at FROM coords';
  const where = [];
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(name LIKE ? OR note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const cols = {
    id: 'id',
    category: 'category',
    name: 'name',
    lat: 'lat',
    lng: 'lng',
    updated_at: 'updated_at',
    created_at: 'created_at',
  };
  const col = cols[String(sortBy || '').toLowerCase()] || 'updated_at';
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  const parseTags = (t) => {
    if (t == null) return null;
    if (typeof t === 'string') {
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
    }

    return t;
  };
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

export async function countCoords({ q, category } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM coords';
  const where = [];
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(name LIKE ? OR note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const [rows] = await p().execute(sql, params);
  return Number(rows[0]?.c || 0);
}

export async function getCoord(id) {
  const [rows] = await p().execute(
    'SELECT id, category, name, lat, lng, note, tags, created_at, updated_at FROM coords WHERE id = ?',
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  let tags = null;
  if (r.tags != null) {
    if (typeof r.tags === 'string') {
      try {
        tags = JSON.parse(r.tags);
      } catch {
        tags = null;
      }
    } else {
      tags = r.tags;
    }
  }
  return { ...r, tags };
}

export async function createCoord({ category = 'top10', name, lat, lng, note, tags }) {
  const tagsJson = Array.isArray(tags)
    ? JSON.stringify(tags)
    : typeof tags === 'object' && tags !== null
    ? JSON.stringify(tags)
    : tags || null;
  const [res] = await p().execute(
    'INSERT INTO coords (category, name, lat, lng, note, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [category, name, Number(lat), Number(lng), note || null, tagsJson]
  );
  return await getCoord(res.insertId);
}

export async function updateCoord(id, { category, name, lat, lng, note, tags }) {
  const fields = [];
  const params = [];
  if (category !== undefined) {
    fields.push('category = ?');
    params.push(category);
  }
  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name);
  }
  if (lat !== undefined) {
    fields.push('lat = ?');
    params.push(Number(lat));
  }
  if (lng !== undefined) {
    fields.push('lng = ?');
    params.push(Number(lng));
  }
  if (note !== undefined) {
    fields.push('note = ?');
    params.push(note);
  }
  if (tags !== undefined) {
    fields.push('tags = ?');
    params.push(
      Array.isArray(tags)
        ? JSON.stringify(tags)
        : typeof tags === 'object' && tags !== null
        ? JSON.stringify(tags)
        : tags || null
    );
  }
  if (!fields.length) return await getCoord(id);
  params.push(id);
  await p().execute(`UPDATE coords SET ${fields.join(', ')} WHERE id = ?`, params);
  return await getCoord(id);
}

export async function deleteCoord(id) {
  const [res] = await p().execute('DELETE FROM coords WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function listIssues({ q, status, limit = 50, offset = 0, sortBy, sortDir } = {}) {
  const params = [];
  let sql = 'SELECT id, title, content, status, tags, created_at, updated_at FROM issues';
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const cols = {
    id: 'id',
    title: 'title',
    status: 'status',
    updated_at: 'updated_at',
    created_at: 'created_at',
  };
  const col = cols[String(sortBy || '').toLowerCase()] || 'updated_at';
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  const parseTags = (t) => {
    if (t == null) return null;
    if (typeof t === 'string') {
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
    }
    return t;
  };
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

export async function countIssues({ q, status } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM issues';
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const [rows] = await p().execute(sql, params);
  return Number(rows[0]?.c || 0);
}

export async function getIssue(id) {
  const [rows] = await p().execute(
    'SELECT id, title, content, status, tags, created_at, updated_at FROM issues WHERE id = ?',
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  let tags = null;
  if (r.tags != null) {
    if (typeof r.tags === 'string') {
      try {
        tags = JSON.parse(r.tags);
      } catch {
        tags = null;
      }
    } else {
      tags = r.tags;
    }
  }
  return { ...r, tags };
}

export async function createIssue({ title, content, status = 'open', tags } = {}) {
  const tagsJson = Array.isArray(tags)
    ? JSON.stringify(tags)
    : typeof tags === 'object' && tags !== null
    ? JSON.stringify(tags)
    : tags || null;
  const [res] = await p().execute(
    'INSERT INTO issues (title, content, status, tags) VALUES (?, ?, ?, ?)',
    [title, content, status, tagsJson]
  );
  return await getIssue(res.insertId);
}

export async function updateIssue(id, { title, content, status, tags } = {}) {
  const fields = [];
  const params = [];
  if (title !== undefined) {
    fields.push('title = ?');
    params.push(title);
  }
  if (content !== undefined) {
    fields.push('content = ?');
    params.push(content);
  }
  if (status !== undefined) {
    fields.push('status = ?');
    params.push(status);
  }
  if (tags !== undefined) {
    fields.push('tags = ?');
    params.push(
      Array.isArray(tags)
        ? JSON.stringify(tags)
        : typeof tags === 'object' && tags !== null
        ? JSON.stringify(tags)
        : tags || null
    );
  }
  if (!fields.length) return await getIssue(id);
  params.push(id);
  await p().execute(`UPDATE issues SET ${fields.join(', ')} WHERE id = ?`, params);
  return await getIssue(id);
}

export async function deleteIssue(id) {
  const [res] = await p().execute('DELETE FROM issues WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function createDeviceProposal(payload = {}) {
  const {
    brand,
    model,
    os,
    type,
    compatible = 0,
    price_range,
    pogo_comp,
    manufacturer_url,
    notes,
    root_links,
  } = payload;
  if (!model || typeof model !== 'string') throw new Error('model required');
  const notesJson = Array.isArray(notes) ? JSON.stringify(notes) : notes || null;
  const rootLinksJson = Array.isArray(root_links) ? JSON.stringify(root_links) : root_links || null;
  const [res] = await p().execute(
    `INSERT INTO device_proposals (brand, model, os, type, compatible, price_range, pogo_comp, manufacturer_url, notes, root_links)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      brand || null,
      model.trim(),
      os || null,
      type || null,
      compatible ? 1 : 0,
      price_range || null,
      pogo_comp || null,
      manufacturer_url || null,
      notesJson,
      rootLinksJson,
    ]
  );
  return await getDeviceProposal(res.insertId);
}

export async function getDeviceProposal(id) {
  const [rows] = await p().execute(
    `SELECT id, brand, model, os, type, compatible, price_range, pogo_comp, manufacturer_url, notes, root_links, status, device_id, approved_by, approved_at, rejected_at, created_at, updated_at
     FROM device_proposals WHERE id = ?`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  const parse = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v;
  };
  return { ...r, notes: parse(r.notes), root_links: parse(r.root_links) };
}

export async function listDeviceProposals({
  status,
  q,
  limit = 50,
  offset = 0,
  sortBy,
  sortDir,
} = {}) {
  const params = [];
  let sql = `SELECT id, brand, model, os, type, compatible, price_range, pogo_comp, manufacturer_url, notes, root_links, status, device_id, approved_by, approved_at, rejected_at, created_at, updated_at FROM device_proposals`;
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(brand LIKE ? OR model LIKE ? OR os LIKE ? OR type LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const cols = {
    id: 'id',
    brand: 'brand',
    model: 'model',
    os: 'os',
    type: 'type',
    status: 'status',
    updated_at: 'updated_at',
    created_at: 'created_at',
  };
  const col = cols[String(sortBy || '').toLowerCase()] || 'updated_at';
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  const parse = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v;
  };
  return rows.map((r) => ({ ...r, notes: parse(r.notes), root_links: parse(r.root_links) }));
}

export async function countDeviceProposals({ status, q } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM device_proposals';
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(brand LIKE ? OR model LIKE ? OR os LIKE ? OR type LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const [rows] = await p().execute(sql, params);
  return Number(rows[0]?.c || 0);
}

export async function approveDeviceProposal(id, approvedByUserId = null) {
  const prop = await getDeviceProposal(id);
  if (!prop) return null;
  if (prop.status !== 'pending') return prop;

  const [ins] = await p().execute(
    `INSERT INTO devices (name, model, brand, type, os, compatible, notes, manufacturer_url, root_links, price_range, pogo_comp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      prop.model,
      prop.model,
      prop.brand || null,
      prop.type || null,
      prop.os || null,
      prop.compatible ? 1 : 0,
      Array.isArray(prop.notes) ? JSON.stringify(prop.notes) : prop.notes || null,
      prop.manufacturer_url || null,
      Array.isArray(prop.root_links) ? JSON.stringify(prop.root_links) : prop.root_links || null,
      prop.price_range || null,
      prop.pogo_comp || null,
    ]
  );
  const deviceId = ins.insertId;
  await p().execute(
    `UPDATE device_proposals SET status='approved', device_id=?, approved_by=?, approved_at=NOW() WHERE id=?`,
    [deviceId, approvedByUserId, id]
  );
  return await getDeviceProposal(id);
}

export async function rejectDeviceProposal(id, rejectedByUserId = null) {
  const prop = await getDeviceProposal(id);
  if (!prop) return null;
  if (prop.status !== 'pending') return prop;
  await p().execute(
    `UPDATE device_proposals SET status='rejected', approved_by=?, rejected_at=NOW() WHERE id=?`,
    [rejectedByUserId, id]
  );
  return await getDeviceProposal(id);
}
