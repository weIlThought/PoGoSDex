import { getPool } from '../mysql.js';
import { PAGINATION, SORT } from '../config/constants.js';
import { parseJsonField, stringifyJsonField } from '../utils/json.js';

const p = () => getPool();

export async function listNews({
  q,
  limit = PAGINATION.DEFAULT_LIMIT,
  offset = 0,
  sortBy,
  sortDir,
} = {}) {
  const params = [];
  let sql = `SELECT id, slug, date, title, excerpt, content, image_url, published, published_at, updated_at_ext, tags,
                    created_at, updated_at
             FROM news`;
  if (q) {
    // Use FULLTEXT search for better performance
    sql += ' WHERE MATCH(title, excerpt, content) AGAINST (? IN NATURAL LANGUAGE MODE)';
    params.push(q);
  }
  const lim = Math.max(
    PAGINATION.MIN_LIMIT,
    Math.min(PAGINATION.MAX_LIMIT, Number(limit) || PAGINATION.DEFAULT_LIMIT)
  );
  const off = Math.max(PAGINATION.MIN_OFFSET, Number(offset) || 0);
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
  const col = cols[String(sortBy || '').toLowerCase()] || SORT.DEFAULT_COLUMN;
  const dir = String(sortDir || '').toUpperCase() === 'ASC' ? 'ASC' : SORT.DEFAULT_DIRECTION;
  sql += ` ORDER BY ${col} ${dir}, id DESC LIMIT ${lim} OFFSET ${off}`;
  const [rows] = await p().execute(sql, params);
  return rows.map((r) => ({ ...r, tags: parseJsonField(r.tags) }));
}

export async function countNews({ q } = {}) {
  const params = [];
  let sql = 'SELECT COUNT(*) AS c FROM news';
  if (q) {
    sql += ' WHERE MATCH(title, excerpt, content) AGAINST (? IN NATURAL LANGUAGE MODE)';
    params.push(q);
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
