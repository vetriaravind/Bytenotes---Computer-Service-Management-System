/**
 * Authentication Controller
 * Manages user registration, login, role provisioning, and password resets.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const { generateToken } = require('../config/jwt');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class AuthController {
  /**
   * @route   POST /api/auth/register
   * @desc    Register a new user and create role-specific profile atomically
   * @access  Public
   */
  static async register(req, res, next) {
    try {
      const { username, email, password, firstName, lastName, phone, role = 'CUSTOMER', profile = {} } = req.body;

      // 1. Check for duplicate email
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        return errorResponse(res, 409, 'An account with this email address already exists.');
      }

      // 2. Check for duplicate username
      const existingUsername = await UserModel.findByUsername(username);
      if (existingUsername) {
        return errorResponse(res, 409, 'This username is already taken. Please choose another.');
      }

      // 3. Hash password using bcryptjs (10 salt rounds)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 4. Atomically insert into users and corresponding profile (Customer/Technician)
      const userId = await UserModel.registerUserWithProfile(
        {
          username,
          email,
          passwordHash,
          role,
          firstName,
          lastName,
          phone
        },
        profile
      );

      // 5. Fetch newly created sanitized profile
      const user = await UserModel.findById(userId);

      // 6. Generate signed JWT Token
      const token = generateToken({
        id: user.id,
        role: user.role,
        email: user.email
      });

      return successResponse(res, 201, 'User account registered successfully', {
        user,
        token
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/login
   * @desc    Authenticate user credentials and issue JWT
   * @access  Public
   */
  static async login(req, res, next) {
    try {
      const { identifier, password } = req.body;

      // 1. Locate user by email OR username
      const userWithHash = await UserModel.findByIdentifier(identifier);
      if (!userWithHash) {
        return errorResponse(res, 401, 'Invalid credentials. Please verify your username/email and password.');
      }

      // 2. Check if account is active
      if (!userWithHash.is_active) {
        return errorResponse(res, 403, 'Your account has been deactivated. Please contact the administrator.');
      }

      // 3. Compare password with stored bcrypt hash
      const isMatch = await bcrypt.compare(password, userWithHash.password_hash);
      if (!isMatch) {
        return errorResponse(res, 401, 'Invalid credentials. Please verify your username/email and password.');
      }

      // 4. Retrieve complete sanitized user profile with role references
      const user = await UserModel.findById(userWithHash.id);

      // 5. Issue JWT Token
      const token = generateToken({
        id: user.id,
        role: user.role,
        email: user.email
      });

      return successResponse(res, 200, 'Login successful', {
        user,
        token
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/auth/me
   * @desc    Get currently logged-in user profile
   * @access  Protected (Requires Bearer token)
   */
  static async getMe(req, res, next) {
    try {
      // req.user is already populated by authMiddleware.protect
      return successResponse(res, 200, 'Authenticated user profile retrieved successfully', {
        user: req.user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/forgot-password
   * @desc    Initiate password reset flow by creating a secure time-limited token
   * @access  Public
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Return success message even if email is not found to prevent user enumeration attacks
        return successResponse(
          res,
          200,
          'If an account exists with this email, a password reset link has been dispatched.'
        );
      }

      // Generate secure 32-byte hexadecimal random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Set expiry to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await UserModel.setPasswordResetToken(user.id, tokenHash, expiresAt);

      return successResponse(res, 200, 'Password reset token generated successfully', {
        message: 'In production this is emailed. For testing and development, use the token below.',
        resetToken
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/reset-password
   * @desc    Reset password using valid reset token
   * @access  Public
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      // Hash provided token to match stored SHA-256 hash
      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

      const user = await UserModel.findByValidResetToken(tokenHash);
      if (!user) {
        return errorResponse(res, 400, 'Password reset token is invalid or has expired.');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);

      // Save new password and invalidate token
      await UserModel.resetPassword(user.id, newPasswordHash);

      return successResponse(res, 200, 'Password has been reset successfully. You may now log in with your new credentials.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/logout
   * @desc    Acknowledge client logout and signal token discard
   * @access  Protected
   */
  static async logout(req, res, next) {
    try {
      return successResponse(res, 200, 'Logged out successfully. Please remove token from client storage.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/auth/users
   * @desc    Admin listing of system users
   * @access  Protected (ADMIN)
   */
  static async getUsers(req, res, next) {
    try {
      const { role = '', search = '', page = 1, limit = 20 } = req.query;
      const result = await UserModel.listUsers({ role, search, page, limit });
      return successResponse(res, 200, 'Users retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/auth/users/:id/toggle-status
   * @desc    Admin activation / deactivation of user account
   * @access  Protected (ADMIN)
   */
  static async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      if (parseInt(id, 10) === req.user.id) {
        return errorResponse(res, 400, 'You cannot deactivate your own admin account.');
      }
      const newStatus = await UserModel.toggleStatus(id);
      return successResponse(res, 200, `Account ${newStatus ? 'activated' : 'deactivated'} successfully`, {
        is_active: newStatus
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
