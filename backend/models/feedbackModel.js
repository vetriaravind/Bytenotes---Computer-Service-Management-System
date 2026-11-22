/**
 * Customer Feedback & Complaints Data Access Model (Module 10)
 */

const { query } = require('../config/db');

class FeedbackModel {
  static async submitFeedback({ serviceRequestId, customerId, rating, comments, isComplaint = false }) {
    const sql = `
      INSERT INTO feedback (
        service_request_id, customer_id, rating, comments, is_complaint
      ) VALUES (?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      serviceRequestId,
      customerId,
      parseInt(rating, 10),
      comments ? comments.trim() : null,
      isComplaint ? 1 : 0
    ]);
    return result.insertId;
  }

  static async findByTicket(serviceRequestId) {
    const sql = `
      SELECT f.*, c.first_name, c.last_name, c.phone
      FROM feedback f
      JOIN customers c ON c.id = f.customer_id
      WHERE f.service_request_id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [serviceRequestId]);
    return rows[0] || null;
  }

  static async listAll({ complaintsOnly = false, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = '1 = 1';
    if (complaintsOnly) whereClause += ' AND f.is_complaint = TRUE';

    const countSql = `SELECT COUNT(*) AS total FROM feedback f WHERE ${whereClause}`;
    const [countRow] = await query(countSql);
    const total = countRow ? countRow.total : 0;

    const dataSql = `
      SELECT f.*, sr.ticket_number, c.first_name, c.last_name, c.phone
      FROM feedback f
      JOIN service_requests sr ON sr.id = f.service_request_id
      JOIN customers c ON c.id = f.customer_id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      feedback: rows
    };
  }
}

module.exports = FeedbackModel;
