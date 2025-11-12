// JSON parsing utilities

/**
 * Safely parse a JSON field from database
 * Handles string JSON, already parsed objects, and null values
 * @param {string|object|null} value - The value to parse
 * @returns {object|null} - Parsed value or null
 */
export function parseJsonField(value) {
  if (value == null) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

/**
 * Stringify a value for JSON database field
 * @param {any} value - Value to stringify
 * @returns {string|null} - JSON string or null
 */
export function stringifyJsonField(value) {
  if (value == null) return null;

  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}
