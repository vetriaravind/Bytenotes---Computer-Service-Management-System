/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 * Enforces permissions across ADMIN, RECEPTIONIST, TECHNICIAN, and CUSTOMER.
 */

const { errorResponse } = require('../utils/apiResponse');

/**
 * Restricts route access to specified roles
 * @param  {...string} roles - Permitted user roles e.g. ('ADMIN', 'RECEPTIONIST')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Unauthorized. Please authenticate first.');
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Forbidden. Access restricted to roles: [${roles.join(', ')}]. Your current role is: [${req.user.role}].`
      );
    }

    next();
  };
};

module.exports = {
  authorize
};
