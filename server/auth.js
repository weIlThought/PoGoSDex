import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { getPool } from './mysql.js';

// Validate JWT_SECRET at module load time
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change-me-in-prod' || JWT_SECRET.length < 32) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  if (isProduction) {
    throw new Error('JWT_SECRET must be set to a secure value (min 32 chars) in production');
  } else if (!isTest) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET is not set or insecure. Set a strong secret in production!'
    );
  }
}

const TOKEN_TTL = process.env.JWT_TTL || '12h';
const COOKIE_NAME = 'admintoken';
const CSRF_COOKIE = 'csrf_token';

export function authMiddleware(app) {
  app.use(cookieParser());
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  req.user = decoded;
  next();
}

export function issueAuthCookies(res, user) {
  const token = signToken({ id: user.id, username: user.username });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });

  const csrf = crypto.randomBytes(16).toString('hex');
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });
  return { csrf };
}

export function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function requireCsrf(req, res, next) {
  const csrfHeader = req.get('x-csrf-token');
  const csrfCookie = req.cookies && req.cookies[CSRF_COOKIE];
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

export async function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const p = getPool();
    const [rows] = await p.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username]
    );
    const user = Array.isArray(rows) && rows[0];
    if (!user) return res.status(404).json({ error: 'Username not found', code: 'USER_NOT_FOUND' });

    const hash = user.password_hash;
    if (!hash || typeof hash !== 'string') {
      console.error('[auth] Missing password hash for user', username);
      return res.status(500).json({ error: 'Login failed', code: 'PASSWORD_HASH_INVALID' });
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, hash);
    } catch (e) {
      console.error('[auth] bcrypt.compare failed:', e);
      return res.status(500).json({ error: 'Login failed', code: 'PASSWORD_HASH_INVALID' });
    }
    if (!ok) return res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });

    const { csrf } = issueAuthCookies(res, { id: user.id, username: user.username });
    res.json({ ok: true, user: { id: user.id, username: user.username }, csrf });
  } catch (e) {
    console.error('[auth] handleLogin error:', e);

    return res.status(503).json({ error: 'Login temporarily unavailable', code: 'DB_UNAVAILABLE' });
  }
}

export function handleLogout(req, res) {
  clearAuthCookies(res);
  res.json({ ok: true });
}

export function meHandler(req, res) {
  const { csrf } = issueAuthCookies(res, { id: req.user.id, username: req.user.username });
  res.json({ user: req.user, csrf });
}
