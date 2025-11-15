// middleware/errorHandler.js

/**
 * ✅ Centralized error handler middleware
 * Converts all thrown or forwarded errors into clean JSON responses.
 */
function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err);

  // --------------------------------------------------
  // 1️⃣ Database constraint errors (PostgreSQL codes)
  // --------------------------------------------------
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        const field = err.detail?.match(/\((.*?)\)/)?.[1] || 'unknown';
        return res.status(409).json({
          status: 'fail',
          message: `Duplicate value for field: ${field}`,
        });

      case '23503': // foreign_key_violation
        return res.status(400).json({
          status: 'fail',
          message: 'Cannot delete or modify because dependent records exist.',
        });

      case '23514': // check_violation
        return res.status(400).json({
          status: 'fail',
          message: 'One or more fields failed a database integrity check.',
        });

      case '22P02': // invalid_text_representation (e.g. invalid UUID)
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid input format or ID provided.',
        });

      default:
        console.warn(`⚠️ Unhandled DB Error Code: ${err.code}`);
        return res.status(500).json({
          status: 'error',
          message: 'Database error occurred.',
        });
    }
  }

  // --------------------------------------------------
  // 2️⃣ Validation errors (from express-validator)
  // --------------------------------------------------
  if (err.errors && Array.isArray(err.errors)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: err.errors.map(e => ({
        field: e.param,
        message: e.msg
      }))
    });
  }

  // --------------------------------------------------
  // 3️⃣ JWT / Authentication related errors
  // --------------------------------------------------
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or missing authentication token.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication token has expired. Please log in again.'
    });
  }

  // --------------------------------------------------
  // 4️⃣ Forbidden / Access Control errors
  // --------------------------------------------------
  if (err.status === 403) {
    return res.status(403).json({
      status: 'fail',
      message: err.message || 'Forbidden: insufficient permissions.'
    });
  }

  // --------------------------------------------------
  // 5️⃣ JSON parse errors or malformed requests
  // --------------------------------------------------
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid JSON format in request body.'
    });
  }

  // --------------------------------------------------
  // 6️⃣ Default / fallback handler
  // --------------------------------------------------
  return res.status(500).json({
    status: 'error',
    message: 'Internal Server Error'
  });
}

module.exports = errorHandler;
