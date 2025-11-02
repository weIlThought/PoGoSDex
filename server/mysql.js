import mysql from 'mysql2/promise';

function parseMysqlUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const protocol = (u.protocol || '').replace(':', '').toLowerCase();
    if (protocol && !['mysql', 'mariadb'].includes(protocol)) return null;
    const params = Object.fromEntries(u.searchParams.entries());
    const sslParam = (params.ssl || params.sslmode || '').toString().toLowerCase();
    // Accept ssl=true, sslmode=required/prefer
    const ssl =
      sslParam === 'true' || sslParam === '1' || sslParam === 'required' || sslParam === 'prefer';
    const sslSkipVerify =
      sslParam === 'skip-verify' || sslParam === 'allow' || sslParam === 'insecure';
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username || 'root'),
      password: decodeURIComponent(u.password || ''),
      database: (u.pathname || '/').replace(/^\//, '') || 'railway',
      ssl,
      sslSkipVerify,
    };
  } catch {
    return null;
  }
}

function resolveMysqlConfig(env = process.env) {
  // Prefer full URLs if provided
  const urlFromEnv =
    env.MYSQL_URL ||
    env.MYSQL_PUBLIC_URL ||
    env.DATABASE_URL ||
    env.CLEARDB_DATABASE_URL ||
    env.JAWSDB_URL;
  const parsed = urlFromEnv ? parseMysqlUrl(urlFromEnv) : null;
  if (parsed) {
    // If URL points to Railway private domain but a TCP proxy is available, prefer the proxy
    const proxyHost = env.RAILWAY_TCP_PROXY_DOMAIN || env.RAILWAY_TCP_PROXY_HOST;
    const proxyPort = env.RAILWAY_TCP_PROXY_PORT ? Number(env.RAILWAY_TCP_PROXY_PORT) : null;
    const privateDomain = env.RAILWAY_PRIVATE_DOMAIN || '';
    const isPrivateDomain = privateDomain && parsed.host === privateDomain;
    const isPrivateV6 = typeof parsed.host === 'string' && /^fd[0-9a-f]{2}:/i.test(parsed.host);
    if (proxyHost && proxyPort && (isPrivateDomain || isPrivateV6)) {
      return { ...parsed, host: proxyHost, port: proxyPort };
    }
    return parsed;
  }

  // Railway: Prefer the TCP proxy if available (publicly reachable) BEFORE private domain
  const tcpProxyHost = env.RAILWAY_TCP_PROXY_DOMAIN || env.RAILWAY_TCP_PROXY_HOST;
  const tcpProxyPort = env.RAILWAY_TCP_PROXY_PORT ? Number(env.RAILWAY_TCP_PROXY_PORT) : null;

  // Accept multiple naming styles (Railway + common variants)
  // Priority order:
  // 1) Explicit MYSQL_HOST / MYSQL_PORT
  // 2) Railway TCP proxy domain/port (if both present)
  // 3) MYSQLHOST / MYSQLPORT (alt spellings)
  // 4) Railway private domain (works only inside Railway private network)
  // 5) localhost
  let host = env.MYSQL_HOST || null;
  let port = env.MYSQL_PORT ? Number(env.MYSQL_PORT) : null;

  if (!host && tcpProxyHost && tcpProxyPort) {
    host = tcpProxyHost;
    port = tcpProxyPort;
  }

  if (!host) host = env.MYSQLHOST || null;
  if (!port && env.MYSQLPORT) port = Number(env.MYSQLPORT);

  if (!host) host = env.RAILWAY_PRIVATE_DOMAIN || null;
  if (!port) port = 3306;

  if (!host) host = 'localhost';

  const user = env.MYSQL_USER || env.MYSQLUSER || 'root';
  const password = env.MYSQL_PASSWORD || env.MYSQLPASSWORD || env.MYSQL_ROOT_PASSWORD || '';
  const database = env.MYSQL_DATABASE || env.MYSQLDATABASE || 'railway';
  // Optional SSL toggle via env
  const sslEnv = (env.MYSQL_SSL || '').toString().toLowerCase();
  const ssl = sslEnv === 'true' || sslEnv === '1' || sslEnv === 'required' || sslEnv === 'on';
  const sslSkipVerify = sslEnv === 'skip-verify' || sslEnv === 'allow' || sslEnv === 'insecure';

  return { host, port, user, password, database, ssl, sslSkipVerify };
}

let pool;

export function getPool() {
  if (!pool) {
    const cfg = resolveMysqlConfig();
    // Safe one-line log to help diagnose prod connectivity
    try {
      const mode = cfg.sslSkipVerify ? 'skip-verify' : cfg.ssl ? 'on' : 'off';
      console.info(
        `[mysql] connecting host=${cfg.host} port=${cfg.port} db=${cfg.database} ssl=${mode}`
      );
    } catch {}
    pool = mysql.createPool({
      host: cfg.host,
      port: Number(cfg.port || 3306),
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z',
      ...(cfg.sslSkipVerify
        ? { ssl: { rejectUnauthorized: false } }
        : cfg.ssl
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
  }
  return pool;
}

export async function migrate() {
  const p = getPool();
  // users table
  await p.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(191) NULL,
    twofa_secret VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // devices table
  await p.execute(`CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(512) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // news table
  await p.execute(`CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(512) NULL,
    published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // coords table
  await p.execute(`CREATE TABLE IF NOT EXISTS coords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category ENUM('top10','notable','raid_spots') NOT NULL DEFAULT 'top10',
    name VARCHAR(255) NOT NULL,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    note TEXT NULL,
    tags JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_coords_category (category),
    INDEX idx_coords_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function seedAdminIfNeeded(logger) {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash
  if (!username || !passwordHash) return; // optional seeding

  const p = getPool();
  const [rows] = await p.execute('SELECT id FROM users WHERE username = ?', [username]);
  if (Array.isArray(rows) && rows.length === 0) {
    await p.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
      username,
      passwordHash,
    ]);
    logger && logger.info && logger.info(`[migrate] Seeded admin user ${username}`);
  }
}
