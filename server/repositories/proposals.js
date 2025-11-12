import { getPool } from '../mysql.js';

const p = () => getPool();

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
    // Use FULLTEXT search for better performance
    where.push('MATCH(brand, model, os, type) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ? OFFSET ?`;
  params.push(lim, off);
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
    // Use FULLTEXT search for better performance
    where.push('MATCH(brand, model, os, type) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
