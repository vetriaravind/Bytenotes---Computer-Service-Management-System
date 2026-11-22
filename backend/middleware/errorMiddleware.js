/**
 * Centralized Error Handling Middleware for ByteNotes
 */

const { errorResponse } = require('../utils/apiResponse');

/**
 * 404 Handler for undefined API routes
 */
const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Global Error Handler catching all synchronous and asynchronous errors
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Handle specific MySQL Database Errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409; // Conflict
    // Extract duplicate field info if possible
    message = 'Duplicate entry detected. A record with this unique identifier already exists.';
    errors = [{ message: err.sqlMessage || 'Unique constraint violation' }];
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400; // Bad Request
    message = 'Foreign key constraint failed. The referenced related record does not exist.';
    errors = [{ message: err.sqlMessage }];
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409; // Conflict
    message = 'Cannot delete or update this record because it is referenced by other records.';
    errors = [{ message: err.sqlMessage }];
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503; // Service Unavailable
    message = 'Database service unavailable. Please ensure MySQL server is active.';
  }

  // Handle Multer File Upload Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed limit (5MB).';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // Handle JWT Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired. Please log in again.';
  }

  // Include stack trace only in development environment
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    errors = {
      stack: err.stack,
      sql: err.sql || undefined
    };
  }

  return errorResponse(res, statusCode, message, errors);
};

module.exports = {
  notFound,
  errorHandler
};
