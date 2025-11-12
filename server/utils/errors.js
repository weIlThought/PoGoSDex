// Error handling utilities for safe API responses

/**
 * Sanitize error messages for API responses
 * In production, hide implementation details; in development, show full errors
 * @param {Error|string} error - The error to sanitize
 * @param {string} fallbackMessage - Generic message to show in production
 * @returns {string} - Safe error message
 */
export function sanitizeError(error, fallbackMessage = 'Internal server error') {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  if (isProduction && !isTest) {
    // In production, return generic message
    return fallbackMessage;
  }

  // In development/test, return detailed error
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Send error response with appropriate status code and sanitized message
 * @param {object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {Error|string} error - The error
 * @param {string} fallbackMessage - Generic message for production
 */
export function sendErrorResponse(res, status, error, fallbackMessage) {
  const message = sanitizeError(error, fallbackMessage);
  res.status(status).json({ error: message });
}
