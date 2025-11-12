// Environment variable validation

/**
 * Validate required environment variables on startup
 * @throws {Error} if required variables are missing or invalid
 */
export function validateEnvironment() {
  const errors = [];

  // Check JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is not set');
  } else if (jwtSecret === 'change-me-in-prod' || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be a secure value (minimum 32 characters)');
  }

  // Check MySQL connection (at least one method must be configured)
  const hasMysqlUrl = !!(
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    process.env.DATABASE_URL
  );
  const hasMysqlConfig = !!(
    process.env.MYSQL_HOST ||
    process.env.MYSQLHOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN
  );

  if (!hasMysqlUrl && !hasMysqlConfig) {
    errors.push('MySQL connection not configured (set MYSQL_URL or MYSQL_HOST)');
  }

  // Warn about optional but recommended variables
  const warnings = [];

  if (!process.env.UPTIMEROBOT_API_KEY) {
    warnings.push('UPTIMEROBOT_API_KEY not set - uptime monitoring disabled');
  }

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
    warnings.push('ADMIN_USERNAME/ADMIN_PASSWORD_HASH not set - no admin user will be seeded');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.ASSET_VERSION) {
    warnings.push('ASSET_VERSION not set - cache busting may not work properly');
  }

  // Throw if critical errors found
  if (errors.length > 0) {
    const message = '❌ Environment validation failed:\n  ' + errors.join('\n  ');
    throw new Error(message);
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    warnings.forEach((w) => console.warn('  -', w));
  }

  return true;
}
