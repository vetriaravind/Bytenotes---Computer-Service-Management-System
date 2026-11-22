/**
 * Service Request Data Access Model
 * Handles parameterized SQL operations for Repair Tickets & Lifecycle Audit (Module 4 & 6).
 */

const { query, pool } = require('../config/db');
const { generateTicketNumber } = require('../utils/ticketGenerator');

class ServiceRequestModel {
  /**
   * Atomically create a new service ticket and log initial status in status_history
   */
  static async createServiceRequest(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Generate unique ticket number (e.g. BN-202611-0001)
      const ticketNumber = await generateTicketNumber();

      // 2. Insert into service_requests table
      const insertSql = `
        INSERT INTO service_requests (
          ticket_number, customer_id, device_id, reported_issue,
          priority, status, estimated_cost, expected_delivery_date, created_by
        ) VALUES (?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?)
      `;
      const [insertResult] = await connection.execute(insertSql, [
        ticketNumber,
        data.customerId,
        data.deviceId,
        data.reportedIssue.trim(),
        data.priority || 'MEDIUM',
        data.estimatedCost || 0.00,
        data.expectedDeliveryDate || null,
        data.createdBy
      ]);

      const requestId = insertResult.insertId;

      // 3. Atomically record initial status in status_history
      const historySql = `
        INSERT INTO status_history (
          service_request_id, previous_status, new_status, changed_by, remarks
        ) VALUES (?, NULL, 'RECEIVED', ?, ?)
      `;
      await connection.execute(historySql, [
        requestId,
        data.createdBy,
        data.intakeRemarks || 'Device received and logged at service center intake desk.'
      ]);

      await connection.commit();
      return { id: requestId, ticketNumber };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Find service request by primary key ID with complete relational joins
   */
  static async findById(id) {
    const sql = `
      SELECT sr.*,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name,
             c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
             d.device_type, d.brand, d.model, d.serial_number,
             d.processor, d.ram, d.storage, d.operating_system,
             d.physical_condition, d.accessories_received, d.password_pin,
             u.username AS created_by_username, u.first_name AS staff_first_name, u.last_name AS staff_last_name,
             t.id AS current_technician_id, t.employee_code AS technician_code,
             tu.first_name AS tech_first_name, tu.last_name AS tech_last_name,
             sa.status AS assignment_status, sa.assigned_at,
             inv.id AS invoice_id, inv.invoice_number, inv.total_amount AS invoice_total, inv.payment_status,
             w.id AS warranty_id, w.warranty_code, w.status AS warranty_status, w.expiry_date AS warranty_expiry
      FROM service_requests sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      JOIN users u ON u.id = sr.created_by
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id AND sa.is_current = TRUE
      LEFT JOIN technicians t ON t.id = sa.technician_id
      LEFT JOIN users tu ON tu.id = t.user_id
      LEFT JOIN invoices inv ON inv.service_request_id = sr.id
      LEFT JOIN warranties w ON w.service_request_id = sr.id
      WHERE sr.id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Find service request by ticket number (used for quick search & customer tracking)
   */
  static async findByTicketNumber(ticketNumber) {
    const sql = `
      SELECT sr.*,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name,
             c.phone AS customer_phone,
             d.brand, d.model, d.serial_number, d.device_type,
             tu.first_name AS tech_first_name, tu.last_name AS tech_last_name
      FROM service_requests sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id AND sa.is_current = TRUE
      LEFT JOIN technicians t ON t.id = sa.technician_id
      LEFT JOIN users tu ON tu.id = t.user_id
      WHERE sr.ticket_number = ?
      LIMIT 1
    `;
    const rows = await query(sql, [ticketNumber.trim().toUpperCase()]);
    return rows[0] || null;
  }

  /**
   * Search and filter service requests with pagination
   */
  static async searchAndFilter({
    search = '',
    status = '',
    priority = '',
    customerId = null,
    technicianId = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 10
  }) {
    const offset = (page - 1) * limit;
    let whereClause = '1 = 1';
    const params = [];

    // Keyword search across ticket number, customer name, phone, device serial
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause += ` AND (
        sr.ticket_number LIKE ? OR
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.phone LIKE ? OR
        d.serial_number LIKE ? OR
        d.brand LIKE ? OR
        d.model LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    if (status) {
      whereClause += ` AND sr.status = ?`;
      params.push(status);
    }

    if (priority) {
      whereClause += ` AND sr.priority = ?`;
      params.push(priority);
    }

    if (customerId) {
      whereClause += ` AND sr.customer_id = ?`;
      params.push(customerId);
    }

    if (technicianId) {
      whereClause += ` AND sa.technician_id = ? AND sa.is_current = TRUE`;
      params.push(technicianId);
    }

    if (startDate) {
      whereClause += ` AND DATE(sr.created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND DATE(sr.created_at) <= ?`;
      params.push(endDate);
    }

    // 1. Total count query
    const countSql = `
      SELECT COUNT(DISTINCT sr.id) AS total
      FROM service_requests sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id AND sa.is_current = TRUE
      WHERE ${whereClause}
    `;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    // 2. Paginated data query
    const dataSql = `
      SELECT sr.id, sr.ticket_number, sr.priority, sr.status, sr.reported_issue,
             sr.estimated_cost, sr.final_cost, sr.expected_delivery_date, sr.created_at,
             c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone,
             d.id AS device_id, d.brand, d.model, d.serial_number, d.device_type,
             t.id AS technician_id, tu.first_name AS tech_first_name, tu.last_name AS tech_last_name
      FROM service_requests sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id AND sa.is_current = TRUE
      LEFT JOIN technicians t ON t.id = sa.technician_id
      LEFT JOIN users tu ON tu.id = t.user_id
      WHERE ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      requests: rows
    };
  }

  /**
   * Update service request metadata
   */
  static async updateServiceRequest(id, data) {
    const sql = `
      UPDATE service_requests SET
        priority = ?,
        estimated_cost = ?,
        expected_delivery_date = ?,
        reported_issue = ?
      WHERE id = ?
    `;
    await query(sql, [
      data.priority,
      data.estimatedCost,
      data.expectedDeliveryDate || null,
      data.reportedIssue,
      id
    ]);
  }

  /**
   * Retrieve complete lifecycle state audit history for a service ticket
   */
  static async getStatusHistory(requestId) {
    const sql = `
      SELECT sh.*, u.username, u.first_name, u.last_name, u.role
      FROM status_history sh
      JOIN users u ON u.id = sh.changed_by
      WHERE sh.service_request_id = ?
      ORDER BY sh.created_at ASC
    `;
    return await query(sql, [requestId]);
  }

  /**
   * Format complete printable intake service receipt data
   */
  static async getReceiptData(id) {
    const request = await this.findById(id);
    if (!request) return null;

    return {
      serviceCenter: {
        name: 'ByteNotes Computer Service Center',
        address: '108 Tech Park Avenue, Silicon Valley Road',
        phone: '+91 98765 43210',
        email: 'support@bytenotes.com',
        gst: '29ABCDE1234F1Z5'
      },
      receiptNumber: `RCP-${request.ticket_number}`,
      ticketNumber: request.ticket_number,
      intakeDate: request.created_at,
      expectedDeliveryDate: request.expected_delivery_date || 'To be communicated after diagnosis',
      priority: request.priority,
      status: request.status,
      customer: {
        name: `${request.customer_first_name} ${request.customer_last_name}`,
        phone: request.customer_phone,
        email: request.customer_email,
        address: request.customer_address
      },
      device: {
        type: request.device_type,
        brand: request.brand,
        model: request.model,
        serialNumber: request.serial_number,
        physicalCondition: request.physical_condition,
        accessoriesReceived: request.accessories_received,
        passwordPinProvided: request.password_pin ? 'Yes' : 'No'
      },
      reportedIssue: request.reported_issue,
      initialEstimatedCost: request.estimated_cost > 0 ? `₹${parseFloat(request.estimated_cost).toFixed(2)}` : 'Diagnosis in progress',
      terms: [
        '1. Minimum diagnostic inspection fee of ₹250 applies if repair estimate is rejected.',
        '2. ByteNotes is not responsible for data loss. Customers are advised to backup data before service.',
        '3. Devices not collected within 30 days of repair completion notification may incur storage fees.',
        '4. Physical intake damage and received accessories are acknowledged as recorded above.'
      ]
    };
  }
}

module.exports = ServiceRequestModel;
