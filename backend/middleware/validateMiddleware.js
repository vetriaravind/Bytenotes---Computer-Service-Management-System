/**
 * Input Validation Middleware for Authentication Routes
 */

const { errorResponse } = require('../utils/apiResponse');

/**
 * Validates registration payload
 */
const validateRegister = (req, res, next) => {
  const { username, email, password, firstName, lastName, phone, role } = req.body;
  const errors = [];

  if (!username || username.trim().length < 3) {
    errors.push({ field: 'username', message: 'Username must be at least 3 characters long.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.push({ field: 'email', message: 'Please provide a valid email address.' });
  }

  if (!password || password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long.' });
  }

  if (!firstName || firstName.trim().length === 0) {
    errors.push({ field: 'firstName', message: 'First name is required.' });
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.push({ field: 'lastName', message: 'Last name is required.' });
  }

  const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
  if (!phone || !phoneRegex.test(phone.trim())) {
    errors.push({ field: 'phone', message: 'Please provide a valid phone number (digits only, 7-20 chars).' });
  }

  const validRoles = ['ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'];
  if (role && !validRoles.includes(role)) {
    errors.push({ field: 'role', message: `Invalid role. Allowed roles are: ${validRoles.join(', ')}` });
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, 'Validation failed. Please correct the input errors.', errors);
  }

  next();
};

/**
 * Validates login payload
 */
const validateLogin = (req, res, next) => {
  const { identifier, password } = req.body;
  const errors = [];

  if (!identifier || identifier.trim().length === 0) {
    errors.push({ field: 'identifier', message: 'Email or Username is required.' });
  }

  if (!password || password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required.' });
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, 'Validation failed.', errors);
  }

  next();
};

/**
 * Validates forgot password payload
 */
const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email.trim())) {
    return errorResponse(res, 400, 'Please provide a valid email address.');
  }

  next();
};

/**
 * Validates reset password payload
 */
const validateResetPassword = (req, res, next) => {
  const { token, newPassword } = req.body;
  const errors = [];

  if (!token || token.trim().length === 0) {
    errors.push({ field: 'token', message: 'Reset token is required.' });
  }

  if (!newPassword || newPassword.length < 6) {
    errors.push({ field: 'newPassword', message: 'New password must be at least 6 characters long.' });
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, 'Validation failed.', errors);
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
};
