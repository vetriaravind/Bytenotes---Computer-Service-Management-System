/**
 * Authentication Routes
 * Maps URL endpoints to AuthController actions and validation middlewares.
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validateMiddleware');

// Public Authentication Endpoints
router.post('/register', validateRegister, AuthController.register);
router.post('/login', validateLogin, AuthController.login);
router.post('/forgot-password', validateForgotPassword, AuthController.forgotPassword);
router.post('/reset-password', validateResetPassword, AuthController.resetPassword);

// Protected User Endpoints (Requires valid JWT Bearer token)
router.get('/me', protect, AuthController.getMe);
router.post('/logout', protect, AuthController.logout);

// Admin User Management (Module 1)
router.get('/users', protect, authorize('ADMIN'), AuthController.getUsers);
router.patch('/users/:id/toggle-status', protect, authorize('ADMIN'), AuthController.toggleUserStatus);

// Role-Verification Test Routes (Demonstrates RBAC protection)
router.get('/admin-only', protect, authorize('ADMIN'), (req, res) => {
  res.json({ success: true, message: 'Welcome Admin! You have elevated permissions.', user: req.user });
});

router.get('/tech-portal', protect, authorize('ADMIN', 'TECHNICIAN'), (req, res) => {
  res.json({ success: true, message: 'Technician portal access granted.', user: req.user });
});

router.get('/reception-desk', protect, authorize('ADMIN', 'RECEPTIONIST'), (req, res) => {
  res.json({ success: true, message: 'Reception desk access granted.', user: req.user });
});

module.exports = router;
