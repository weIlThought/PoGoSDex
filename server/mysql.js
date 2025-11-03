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
  
  const urlFromEnv =
    env.MYSQL_URL ||
    env.MYSQL_PUBLIC_URL ||
    env.DATABASE_URL ||
    env.CLEARDB_DATABASE_URL ||
    env.JAWSDB_URL;
  const parsed = urlFromEnv ? parseMysqlUrl(urlFromEnv) : null;
  if (parsed) {
    
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

  
  const tcpProxyHost = env.RAILWAY_TCP_PROXY_DOMAIN || env.RAILWAY_TCP_PROXY_HOST;
  const tcpProxyPort = env.RAILWAY_TCP_PROXY_PORT ? Number(env.RAILWAY_TCP_PROXY_PORT) : null;

  
  
  
  
  
  
  
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
  
  const sslEnv = (env.MYSQL_SSL || '').toString().toLowerCase();
  const ssl = sslEnv === 'true' || sslEnv === '1' || sslEnv === 'required' || sslEnv === 'on';
  const sslSkipVerify = sslEnv === 'skip-verify' || sslEnv === 'allow' || sslEnv === 'insecure';

  return { host, port, user, password, database, ssl, sslSkipVerify };
}

let pool;

export function getPool() {
  if (!pool) {
    const cfg = resolveMysqlConfig();
    
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
  
  await p.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(191) NULL,
    twofa_secret VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
  await p.execute(`CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(512) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
  await p.execute(`CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(512) NULL,
    published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
  await p.execute(`CREATE TABLE IF NOT EXISTS issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
    tags JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_issues_status (status),
    INDEX idx_issues_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
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

  
  await p.execute(`CREATE TABLE IF NOT EXISTS visitors (
    day DATE NOT NULL,
    hits INT NOT NULL DEFAULT 0,
    PRIMARY KEY (day)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
  await p.execute(`CREATE TABLE IF NOT EXISTS visitor_sessions (
    day DATE NOT NULL,
    hash CHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, hash),
    INDEX idx_vs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  
  
  const hasColumn = async (table, column) => {
    const [rows] = await p.execute(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return Number(rows?.[0]?.c || 0) > 0;
  };

  
  if (!(await hasColumn('devices', 'model'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN model VARCHAR(191) NULL AFTER name`);
  }
  if (!(await hasColumn('devices', 'brand'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN brand VARCHAR(191) NULL AFTER model`);
  }
  if (!(await hasColumn('devices', 'type'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN type VARCHAR(50) NULL AFTER brand`);
  }
  if (!(await hasColumn('devices', 'os'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN os VARCHAR(100) NULL AFTER type`);
  }
  if (!(await hasColumn('devices', 'compatible'))) {
    await p.execute(
      `ALTER TABLE devices ADD COLUMN compatible TINYINT(1) NOT NULL DEFAULT 0 AFTER os`
    );
  }
  if (!(await hasColumn('devices', 'notes'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN notes JSON NULL AFTER compatible`);
  }
  if (!(await hasColumn('devices', 'manufacturer_url'))) {
    await p.execute(
      `ALTER TABLE devices ADD COLUMN manufacturer_url VARCHAR(512) NULL AFTER notes`
    );
  }
  if (!(await hasColumn('devices', 'root_links'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN root_links JSON NULL AFTER manufacturer_url`);
  }
  if (!(await hasColumn('devices', 'price_range'))) {
    await p.execute(
      `ALTER TABLE devices ADD COLUMN price_range VARCHAR(100) NULL AFTER root_links`
    );
  }
  if (!(await hasColumn('devices', 'pogo_comp'))) {
    await p.execute(`ALTER TABLE devices ADD COLUMN pogo_comp VARCHAR(100) NULL AFTER price_range`);
  }

  
  if (!(await hasColumn('news', 'slug'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN slug VARCHAR(191) NULL UNIQUE AFTER id`);
  }
  if (!(await hasColumn('news', 'date'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN date DATE NULL AFTER slug`);
  }
  if (!(await hasColumn('news', 'excerpt'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN excerpt TEXT NULL AFTER title`);
  }
  if (!(await hasColumn('news', 'published_at'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN published_at DATETIME NULL AFTER excerpt`);
  }
  if (!(await hasColumn('news', 'updated_at_ext'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN updated_at_ext DATETIME NULL AFTER published_at`);
  }
  if (!(await hasColumn('news', 'tags'))) {
    await p.execute(`ALTER TABLE news ADD COLUMN tags JSON NULL AFTER image_url`);
  }

  
  if (!(await hasColumn('issues', 'tags'))) {
    await p.execute(`ALTER TABLE issues ADD COLUMN tags JSON NULL AFTER status`);
  }

  
  await p.execute(`CREATE TABLE IF NOT EXISTS device_proposals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(191) NULL,
    model VARCHAR(191) NOT NULL,
    os VARCHAR(100) NULL,
    type VARCHAR(50) NULL,
    compatible TINYINT(1) NOT NULL DEFAULT 0,
    price_range VARCHAR(100) NULL,
    pogo_comp VARCHAR(100) NULL,
    manufacturer_url VARCHAR(512) NULL,
    notes JSON NULL,
    root_links JSON NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    device_id INT NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    rejected_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dp_status (status),
    INDEX idx_dp_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function seedAdminIfNeeded(logger) {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH; 
  if (!username || !passwordHash) return; 

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
