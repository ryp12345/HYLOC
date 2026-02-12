/**
 * Simple logger utility used by controllers.
 * Exposes `logError(error, location, userId)` which currently logs to console
 * and can be extended to persist errors to a table or external service.
 */
async function logError(error, location = 'unknown', userId = null) {
  try {
    const msg = (error && error.message) ? error.message : String(error);
    console.error(`[${location}]`, { message: msg, userId, stack: error && error.stack });
    // Future: persist to DB or external error-tracking service
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}

module.exports = { logError };
