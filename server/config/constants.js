// Configuration constants for the application

export const PAGINATION = {
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 50,
  MIN_OFFSET: 0,
};

export const RATE_LIMIT = {
  LOGIN: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_ATTEMPTS: 5,
  },
  ADMIN_API: {
    WINDOW_MS: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS: 60,
  },
  PROPOSAL: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 5,
  },
};

export const TIMEOUT = {
  DEFAULT_FETCH_MS: 8000,
  UPTIME_CACHE_MS: 60000, // 1 minute
};

export const CACHE = {
  PGSHARP_VERSION_MS: 60 * 60 * 1000, // 1 hour
  POKEMINERS_VERSION_MS: 60 * 60 * 1000, // 1 hour
  UPTIME_CACHE_MS: 60 * 1000, // 1 minute
  HTML_MAX_AGE_SECONDS: 3600, // 1 hour
};

export const AUTH = {
  JWT_MIN_LENGTH: 32,
  TOKEN_TTL_DEFAULT: '12h',
  COOKIE_MAX_AGE_MS: 1000 * 60 * 60 * 12, // 12 hours
  BCRYPT_ROUNDS: 12,
};

export const SORT = {
  DEFAULT_COLUMN: 'updated_at',
  DEFAULT_DIRECTION: 'DESC',
  VALID_DIRECTIONS: ['ASC', 'DESC'],
};
