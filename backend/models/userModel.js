/**
 * User Data Access Model
 * Handles parameterized SQL queries for users, customers, and technicians.
 */

const { query, pool } = require('../config/db');

class UserModel {
  /**
   * Find user by email address
   */
  static async findByEmail(email) {
    const sql = `
      SELECT id, username, email, password_hash, role, first_name, last_name, phone, is_active, created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `;
    const rows = await query(sql, [email.toLowerCase().trim()]);
    return rows[0] || null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    const sql = `
      SELECT id, username, email, password_hash, role, first_name, last_name, phone, is_active, created_at
      FROM users
      WHERE username = ?
      LIMIT 1
    `;
    const rows = await query(sql, [username.trim()]);
    return rows[0] || null;
  }

  /**
   * Find user by either email OR username (for flexible login)
   */
  static async findByIdentifier(identifier) {
    const sql = `
      SELECT id, username, email, password_hash, role, first_name, last_name, phone, is_active, created_at
      FROM users
      WHERE email = ? OR username = ?
      LIMIT 1
    `;
    const rows = await query(sql, [identifier.toLowerCase().trim(), identifier.trim()]);
    return rows[0] || null;
  }

  /**
   * Find user by primary key ID (sanitized, excluding password_hash)
   */
  static async findById(id) {
    const sql = `
      SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
             c.id AS customer_profile_id,
             t.id AS technician_profile_id, t.employee_code, t.specialization, t.status AS technician_status
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      LEFT JOIN technicians t ON t.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Atomically register user and associated profile (Customer or Technician) using a MySQL transaction
   */
  static async registerUserWithProfile(userData, profileData = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Insert into users table
      const userSql = `
        INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const [userResult] = await connection.execute(userSql, [
        userData.username.trim(),
        userData.email.toLowerCase().trim(),
        userData.passwordHash,
        userData.role,
        userData.firstName.trim(),
        userData.lastName.trim(),
        userData.phone.trim()
      ]);

      const userId = userResult.insertId;

      // 2. If role is CUSTOMER, create or link customer profile
      if (userData.role === 'CUSTOMER') {
        // Check if a customer already exists with this phone number (e.g. from an earlier walk-in service)
        const [existingCustomer] = await connection.execute(
          'SELECT id, user_id FROM customers WHERE phone = ? LIMIT 1',
          [userData.phone.trim()]
        );

        if (existingCustomer.length > 0) {
          // Link existing walk-in customer profile with this newly registered user account!
          await connection.execute(
            'UPDATE customers SET user_id = ?, email = ? WHERE id = ?',
            [userId, userData.email.toLowerCase().trim(), existingCustomer[0].id]
          );
        } else {
          // Create a brand new customer profile
          const customerSql = `
            INSERT INTO customers (user_id, first_name, last_name, phone, email, address, city, state, postal_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.execute(customerSql, [
            userId,
            userData.firstName.trim(),
            userData.lastName.trim(),
            userData.phone.trim(),
            userData.email.toLowerCase().trim(),
            profileData.address || null,
            profileData.city || null,
            profileData.state || null,
            profileData.postalCode || null
          ]);
        }
      }

      // 3. If role is TECHNICIAN, create technician profile
      if (userData.role === 'TECHNICIAN') {
        const empCode = profileData.employeeCode || `TECH-${Date.now().toString().slice(-4)}`;
        const techSql = `
          INSERT INTO technicians (user_id, employee_code, specialization, experience_years, max_active_tickets, status)
          VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
        `;
        await connection.execute(techSql, [
          userId,
          empCode,
          profileData.specialization || 'General Computer Repair',
          profileData.experienceYears || 0,
          profileData.maxActiveTickets || 5
        ]);
      }

      await connection.commit();
      return userId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Set password reset token with expiration (1 hour)
   */
  static async setPasswordResetToken(userId, tokenHash, expiresAt) {
    const sql = `
      UPDATE users
      SET reset_password_token = ?, reset_password_expires = ?
      WHERE id = ?
    `;
    await query(sql, [tokenHash, expiresAt, userId]);
  }

  /**
   * Find user by valid, non-expired password reset token
   */
  static async findByValidResetToken(tokenHash) {
    const sql = `
      SELECT id, email, username
      FROM users
      WHERE reset_password_token = ? AND reset_password_expires > NOW()
      LIMIT 1
    `;
    const rows = await query(sql, [tokenHash]);
    return rows[0] || null;
  }

  /**
   * Reset user password and clear token
   */
  static async resetPassword(userId, newPasswordHash) {
    const sql = `
      UPDATE users
      SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL
      WHERE id = ?
    `;
    await query(sql, [newPasswordHash, userId]);
  }

  /**
   * List users with optional role and search filtering for Admin
   */
  static async listUsers({ role = '', search = '', page = 1, limit = 20 } = {}) {
    let whereClause = '1=1';
    const params = [];
    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }
    if (search) {
      whereClause += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    const offset = (page - 1) * limit;
    const [countRow] = await query(`SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`, params);
    const sql = `
      SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
             c.id AS customer_profile_id,
             t.id AS technician_profile_id, t.employee_code, t.specialization, t.status AS technician_status
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      LEFT JOIN technicians t ON t.user_id = u.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);
    return {
      total: countRow ? countRow.total : 0,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil((countRow ? countRow.total : 0) / limit),
      users: rows
    };
  }

  /**
   * Toggle account activation state
   */
  static async toggleStatus(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    const newStatus = !user.is_active;
    await query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    return newStatus;
  }
}

module.exports = UserModel;
