import { getPool } from './mysql.js';

const p = () => getPool();

// Devices
export async function listDevices({ q, limit = 50, offset = 0 } = {}) {
  const params = [];
  let sql = 'SELECT id, name, description, image_url, status, created_at, updated_at FROM devices';
  if (q) {
    sql += ' WHERE name LIKE ? OR description LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  sql += ` ORDER BY updated_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  return rows;
}

export async function getDevice(id) {
  const [rows] = await p().execute(
    'SELECT id, name, description, image_url, status, created_at, updated_at FROM devices WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function createDevice({ name, description, image_url, status = 'active' }) {
  const [res] = await p().execute(
    'INSERT INTO devices (name, description, image_url, status) VALUES (?, ?, ?, ?)',
    [name, description || null, image_url || null, status]
  );
  return await getDevice(res.insertId);
}

export async function updateDevice(id, { name, description, image_url, status }) {
  const fields = [];
  const params = [];
  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    params.push(description);
  }
  if (image_url !== undefined) {
    fields.push('image_url = ?');
    params.push(image_url);
  }
  if (status !== undefined) {
    fields.push('status = ?');
    params.push(status);
  }
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
  let sql = 'SELECT id, title, content, image_url, published, created_at, updated_at FROM news';
  if (q) {
    sql += ' WHERE title LIKE ? OR content LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  sql += ` ORDER BY updated_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  return rows;
}

export async function getNews(id) {
  const [rows] = await p().execute(
    'SELECT id, title, content, image_url, published, created_at, updated_at FROM news WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function createNews({ title, content, image_url, published = 0 }) {
  const [res] = await p().execute(
    'INSERT INTO news (title, content, image_url, published) VALUES (?, ?, ?, ?)',
    [title, content, image_url || null, published ? 1 : 0]
  );
  return await getNews(res.insertId);
}

export async function updateNews(id, { title, content, image_url, published }) {
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
  if (image_url !== undefined) {
    fields.push('image_url = ?');
    params.push(image_url);
  }
  if (published !== undefined) {
    fields.push('published = ?');
    params.push(published ? 1 : 0);
  }
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
