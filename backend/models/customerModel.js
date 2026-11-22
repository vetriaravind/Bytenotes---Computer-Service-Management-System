/**
 * Customer Data Access Model
 * Handles parameterized SQL operations for Customer Management (Module 2).
 */

const { query } = require('../config/db');

class CustomerModel {
  /**
   * Create a new walk-in or portal customer
   */
  static async createCustomer(customerData) {
    const sql = `
      INSERT INTO customers (
        user_id, first_name, last_name, phone, email, alt_phone,
        address, city, state, postal_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      customerData.userId || null,
      customerData.firstName.trim(),
      customerData.lastName.trim(),
      customerData.phone.trim(),
      customerData.email ? customerData.email.toLowerCase().trim() : null,
      customerData.altPhone ? customerData.altPhone.trim() : null,
      customerData.address ? customerData.address.trim() : null,
      customerData.city ? customerData.city.trim() : null,
      customerData.state ? customerData.state.trim() : null,
      customerData.postalCode ? customerData.postalCode.trim() : null,
      customerData.notes ? customerData.notes.trim() : null
    ]);
    return result.insertId;
  }

  /**
   * Find customer by primary key ID
   */
  static async findById(id) {
    const sql = `
      SELECT c.*,
             u.username, u.is_active AS user_active,
             COUNT(DISTINCT d.id) AS total_devices,
             COUNT(DISTINCT sr.id) AS total_service_requests
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN devices d ON d.customer_id = c.id
      LEFT JOIN service_requests sr ON sr.customer_id = c.id
      WHERE c.id = ?
      GROUP BY c.id
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Find customer by exact phone number (used for duplicate prevention)
   */
  static async findByPhone(phone) {
    const sql = `
      SELECT * FROM customers WHERE phone = ? LIMIT 1
    `;
    const rows = await query(sql, [phone.trim()]);
    return rows[0] || null;
  }

  /**
   * Find customer by linked user account ID
   */
  static async findByUserId(userId) {
    const sql = `
      SELECT * FROM customers WHERE user_id = ? LIMIT 1
    `;
    const rows = await query(sql, [userId]);
    return rows[0] || null;
  }

  /**
   * Search and filter customers with pagination
   * Searches across: first_name, last_name, phone, email
   */
  static async searchCustomers({ search = '', page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    let whereClause = '1 = 1';
    const params = [];

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause += ` AND (
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.phone LIKE ? OR
        c.email LIKE ? OR
        CONCAT(c.first_name, ' ', c.last_name) LIKE ?
      )`;
      params.push(term, term, term, term, term);
    }

    // 1. Get total record count
    const countSql = `SELECT COUNT(*) AS total FROM customers c WHERE ${whereClause}`;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    // 2. Fetch paginated records with device counts
    const dataSql = `
      SELECT c.*,
             COUNT(DISTINCT d.id) AS total_devices,
             COUNT(DISTINCT sr.id) AS total_service_requests
      FROM customers c
      LEFT JOIN devices d ON d.customer_id = c.id
      LEFT JOIN service_requests sr ON sr.customer_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];
    const rows = await query(dataSql, dataParams);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      customers: rows
    };
  }

  /**
   * Update existing customer information
   */
  static async updateCustomer(id, data) {
    const sql = `
      UPDATE customers SET
        first_name = ?,
        last_name = ?,
        email = ?,
        alt_phone = ?,
        address = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        notes = ?
      WHERE id = ?
    `;
    await query(sql, [
      data.firstName.trim(),
      data.lastName.trim(),
      data.email ? data.email.toLowerCase().trim() : null,
      data.altPhone ? data.altPhone.trim() : null,
      data.address ? data.address.trim() : null,
      data.city ? data.city.trim() : null,
      data.state ? data.state.trim() : null,
      data.postalCode ? data.postalCode.trim() : null,
      data.notes ? data.notes.trim() : null,
      id
    ]);
  }

  /**
   * Get all devices belonging to a customer (Real-World Scenario 15)
   */
  static async getDevices(customerId) {
    const sql = `
      SELECT d.*,
             COUNT(DISTINCT sr.id) AS service_count,
             MAX(sr.created_at) AS last_serviced_at
      FROM devices d
      LEFT JOIN service_requests sr ON sr.device_id = d.id
      WHERE d.customer_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    return await query(sql, [customerId]);
  }

  /**
   * Get complete service ticket history for a customer
   */
  static async getServiceHistory(customerId) {
    const sql = `
      SELECT sr.id, sr.ticket_number, sr.priority, sr.status, sr.reported_issue,
             sr.estimated_cost, sr.final_cost, sr.created_at, sr.actual_delivery_date,
             d.brand, d.model, d.serial_number, d.device_type,
             inv.invoice_number, inv.total_amount, inv.payment_status
      FROM service_requests sr
      JOIN devices d ON d.id = sr.device_id
      LEFT JOIN invoices inv ON inv.service_request_id = sr.id
      WHERE sr.customer_id = ?
      ORDER BY sr.created_at DESC
    `;
    return await query(sql, [customerId]);
  }

  /**
   * Delete customer if no active service requests exist
   */
  static async deleteCustomer(customerId) {
    const history = await CustomerModel.getServiceHistory(customerId);
    if (history.length > 0) {
      throw new Error(`Cannot delete customer: Customer has ${history.length} service request records in system history.`);
    }
    // Delete any devices registered
    await query('DELETE FROM devices WHERE customer_id = ?', [customerId]);
    await query('DELETE FROM customers WHERE id = ?', [customerId]);
    return true;
  }
}

module.exports = CustomerModel;
