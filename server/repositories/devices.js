import { getPool } from '../mysql.js';

const p = () => getPool();

export async function listDevices({ q, limit = 50, offset = 0, sortBy, sortDir } = {}) {
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
  const cols = {
    id: 'id',
    name: 'name',
    model: 'model',
    brand: 'brand',
    type: 'type',
    os: 'os',
    compatible: 'compatible',
    price_range: 'price_range',
    pogo_comp: 'pogo_comp',
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
  return rows.map((r) => ({
    ...r,
    notes: parseJson(r.notes),
    root_links: parseJson(r.root_links),
  }));
}

export async function countDevices({ q } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM devices';
  if (q) {
    sql +=
      ' WHERE name LIKE ? OR description LIKE ? OR model LIKE ? OR brand LIKE ? OR type LIKE ? OR os LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await p().execute(sql, params);
  return Number(rows[0]?.c || 0);
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
