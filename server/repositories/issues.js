import { getPool } from '../mysql.js';

const p = () => getPool();

export async function listIssues({ q, status, limit = 50, offset = 0, sortBy, sortDir } = {}) {
  const params = [];
  let sql = 'SELECT id, title, content, status, tags, created_at, updated_at FROM issues';
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    // Use FULLTEXT search for better performance
    where.push('MATCH(title, content) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
    // Use FULLTEXT search for better performance
    where.push('MATCH(title, content) AGAINST (? IN NATURAL LANGUAGE MODE)');
    params.push(q);
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
