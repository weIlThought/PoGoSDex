import { getPool } from '../mysql.js';

const p = () => getPool();

export async function listCoords({ q, category, limit = 50, offset = 0, sortBy, sortDir } = {}) {
  const params = [];
  let sql = 'SELECT id, category, name, lat, lng, note, tags, created_at, updated_at FROM coords';
  const where = [];
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    // Use FULLTEXT search for better performance
    where.push('MATCH(name, note) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
    // Use FULLTEXT search for better performance
    where.push('MATCH(name, note) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
