/**
 * JWT Authentication Middleware
 * Protects endpoints by verifying Bearer tokens and attaching the user object.
 */

const { verifyToken } = require('../config/jwt');
const UserModel = require('../models/userModel');
const { errorResponse } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  let token = null;

  // Check if Bearer token is provided in the Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 401, 'Access denied. No authentication token provided.');
  }

  try {
    // 1. Verify token signature and expiration
    const decoded = verifyToken(token);

    // 2. Fetch full sanitized user profile from MySQL
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 401, 'Authentication failed. User account no longer exists.');
    }

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account is deactivated. Please contact the administrator.');
    }

    // 3. Attach user context to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Authentication token expired. Please log in again.');
    }
    return errorResponse(res, 401, 'Invalid authentication token.');
  }
};

module.exports = {
  protect
};
