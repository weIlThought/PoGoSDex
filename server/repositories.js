import { getPool } from './mysql.js';

const p = () => getPool();

// Devices
export async function listDevices({ q, limit = 50, offset = 0 } = {}) {
  const params = [];
  let sql = `SELECT id, name, description, image_url, status,
                    model, brand, type, os, compatible, notes, manufacturer_url, root_links,
                    price_range, pogo_comp,
                    created_at, updated_at
             FROM devices`;
  if (q) {
    sql +=
      ' WHERE name LIKE ? OR description LIKE ? OR model LIKE ? OR brand LIKE ? OR type LIKE ? OR os LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  sql += ` ORDER BY updated_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`;
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
  return rows.map((r) => ({
    ...r,
    notes: parseJson(r.notes),
    root_links: parseJson(r.root_links),
  }));
}

export async function getDevice(id) {
  const [rows] = await p().execute(
    `SELECT id, name, description, image_url, status,
            model, brand, type, os, compatible, notes, manufacturer_url, root_links,
            price_range, pogo_comp,
            created_at, updated_at
     FROM devices WHERE id = ?`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
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
  return { ...r, notes: parseJson(r.notes), root_links: parseJson(r.root_links) };
}

export async function createDevice(payload) {
  const {
    name,
    description,
    image_url,
    status = 'active',
    model,
    brand,
    type,
    os,
    compatible = 0,
    notes,
    manufacturer_url,
    root_links,
    price_range,
    pogo_comp,
  } = payload || {};
  const notesJson = Array.isArray(notes) ? JSON.stringify(notes) : notes || null;
  const rootLinksJson = Array.isArray(root_links) ? JSON.stringify(root_links) : root_links || null;
  const [res] = await p().execute(
    `INSERT INTO devices (name, description, image_url, status, model, brand, type, os, compatible, notes, manufacturer_url, root_links, price_range, pogo_comp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description || null,
      image_url || null,
      status,
      model || null,
      brand || null,
      type || null,
      os || null,
      compatible ? 1 : 0,
      notesJson,
      manufacturer_url || null,
      rootLinksJson,
      price_range || null,
      pogo_comp || null,
    ]
  );
  return await getDevice(res.insertId);
}

export async function updateDevice(id, payload) {
  const fields = [];
  const params = [];
  const set = (col, val, transform = (x) => x) => {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      params.push(transform(val));
    }
  };
  set('name', payload.name);
  set('description', payload.description);
  set('image_url', payload.image_url);
  set('status', payload.status);
  set('model', payload.model);
  set('brand', payload.brand);
  set('type', payload.type);
  set('os', payload.os);
  set('compatible', payload.compatible, (v) => (v ? 1 : 0));
  set('notes', payload.notes, (v) => (Array.isArray(v) ? JSON.stringify(v) : v || null));
  set('manufacturer_url', payload.manufacturer_url);
  set('root_links', payload.root_links, (v) => (Array.isArray(v) ? JSON.stringify(v) : v || null));
  set('price_range', payload.price_range);
  set('pogo_comp', payload.pogo_comp);
  if (!fields.length) return await getDevice(id);
  params.push(id);
  await p().execute(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`, params);
  return await getDevice(id);
}

export async function deleteDevice(id) {
  const [res] = await p().execute('DELETE FROM devices WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// News
export async function listNews({ q, limit = 50, offset = 0 } = {}) {
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
  sql += ` ORDER BY updated_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`;
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
    // keep legacy published but prefer published_at presence for UI
    published = 0,
    published_at,
    updated_at, // may be mapped from updatedAt
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

// Coords
export async function listCoords({ q, category, limit = 50, offset = 0 } = {}) {
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
  sql += ` ORDER BY updated_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`;
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
    // already parsed JSON (object or array) from driver
    return t;
  };
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
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
