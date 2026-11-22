/**
 * Warranty Data Access Model
 * Manages post-repair guarantee certificates & validity verification (Module 12 & Scenario 10).
 */

const { query } = require('../config/db');

class WarrantyModel {
  static async generateWarrantyCode() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `WAR-${year}${month}-`;

    const sql = `SELECT warranty_code FROM warranties WHERE warranty_code LIKE ? ORDER BY id DESC LIMIT 1`;
    const rows = await query(sql, [`${prefix}%`]);

    let seq = 1;
    if (rows.length > 0 && rows[0].warranty_code) {
      const parts = rows[0].warranty_code.split('-');
      if (parts.length === 3) {
        const last = parseInt(parts[2], 10);
        if (!isNaN(last)) seq = last + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create warranty certificate when repair is completed/delivered
   */
  static async createWarranty({ serviceRequestId, deviceId, warrantyPeriodDays = 90, terms = null }) {
    const code = await this.generateWarrantyCode();
    const days = parseInt(warrantyPeriodDays, 10) || 90;

    const startDate = new Date();
    const expiryDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    const sql = `
      INSERT INTO warranties (
        warranty_code, service_request_id, device_id, warranty_period_days,
        start_date, expiry_date, terms, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `;
    const result = await query(sql, [
      code,
      serviceRequestId,
      deviceId,
      days,
      startDate.toISOString().slice(0, 10),
      expiryDate.toISOString().slice(0, 10),
      terms || 'Covers replaced parts and workmanship. Accidental or liquid damage excluded.'
    ]);

    return { id: result.insertId, warrantyCode: code, expiryDate: expiryDate.toISOString().slice(0, 10) };
  }

  /**
   * Check warranty eligibility for a device (Scenario 10)
   */
  static async checkEligibility(serialNumberOrTicket) {
    const sql = `
      SELECT w.*, d.brand, d.model, d.serial_number, d.device_type,
             sr.ticket_number, sr.reported_issue,
             c.first_name AS customer_first, c.last_name AS customer_last, c.phone AS customer_phone,
             (w.expiry_date >= CURDATE() AND w.status = 'ACTIVE') AS is_valid,
             DATEDIFF(w.expiry_date, CURDATE()) AS days_remaining
      FROM warranties w
      JOIN devices d ON d.id = w.device_id
      JOIN service_requests sr ON sr.id = w.service_request_id
      JOIN customers c ON c.id = sr.customer_id
      WHERE d.serial_number = ? OR sr.ticket_number = ? OR w.warranty_code = ?
      ORDER BY w.created_at DESC
      LIMIT 1
    `;
    const rows = await query(sql, [serialNumberOrTicket.trim(), serialNumberOrTicket.trim(), serialNumberOrTicket.trim()]);
    return rows[0] || null;
  }

  /**
   * List warranties with optional customer filtering
   */
  static async listWarranties({ customerId = null, page = 1, limit = 20 } = {}) {
    let whereClause = '1=1';
    const params = [];
    if (customerId) {
      whereClause += ' AND sr.customer_id = ?';
      params.push(customerId);
    }
    const offset = (page - 1) * limit;
    const countSql = `
      SELECT COUNT(*) AS total
      FROM warranties w
      JOIN service_requests sr ON sr.id = w.service_request_id
      WHERE ${whereClause}
    `;
    const [countRow] = await query(countSql, params);
    const sql = `
      SELECT w.*, d.brand, d.model, d.serial_number, d.device_type,
             sr.ticket_number, sr.reported_issue,
             c.first_name AS customer_first, c.last_name AS customer_last, c.phone AS customer_phone,
             (w.expiry_date >= CURDATE() AND w.status = 'ACTIVE') AS is_valid,
             DATEDIFF(w.expiry_date, CURDATE()) AS days_remaining
      FROM warranties w
      JOIN devices d ON d.id = w.device_id
      JOIN service_requests sr ON sr.id = w.service_request_id
      JOIN customers c ON c.id = sr.customer_id
      WHERE ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);
    return {
      total: countRow ? countRow.total : 0,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      warranties: rows
    };
  }
}

module.exports = WarrantyModel;
