/**
 * Analytics & Executive Dashboard Data Access Model (Module 13)
 */

const { query } = require('../config/db');

class AnalyticsModel {
  /**
   * Top-level KPI counts and financial statistics
   */
  static async getOverviewStats() {
    // 1. Customer & Device totals
    const [counts] = await query(`
      SELECT
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM devices) AS total_devices,
        (SELECT COUNT(*) FROM service_requests) AS total_requests,
        (SELECT COUNT(*) FROM service_requests WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'UNREPAIRABLE')) AS pending_repairs,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'IN_PROGRESS') AS in_progress_repairs,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'DELIVERED') AS completed_repairs,
        (SELECT COUNT(*) FROM technicians WHERE status = 'AVAILABLE') AS available_technicians,
        (SELECT COUNT(*) FROM technicians WHERE status != 'INACTIVE') AS active_technicians,
        (SELECT COUNT(*) FROM inventory WHERE quantity_in_stock <= reorder_threshold) AS low_stock_items
    `);

    // 2. Financial totals
    const [financials] = await query(`
      SELECT
        COALESCE(SUM(paid_amount), 0.00) AS total_revenue_collected,
        COALESCE(SUM(balance_amount), 0.00) AS pending_receivables,
        COALESCE(SUM(total_amount), 0.00) AS total_invoiced
      FROM invoices
    `);

    return {
      overview: counts,
      financials
    };
  }

  /**
   * Monthly revenue aggregation for charts
   */
  static async getMonthlyRevenue(months = 6) {
    const sql = `
      SELECT
        DATE_FORMAT(invoice_date, '%b %Y') AS month_label,
        DATE_FORMAT(invoice_date, '%Y-%m') AS sort_key,
        COALESCE(SUM(total_amount), 0.00) AS total_invoiced,
        COALESCE(SUM(paid_amount), 0.00) AS total_collected
      FROM invoices
      WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY sort_key, month_label
      ORDER BY sort_key ASC
    `;
    return await query(sql, [parseInt(months, 10)]);
  }

  /**
   * Technician workload and completion rankings
   */
  static async getTechnicianPerformance() {
    const sql = `
      SELECT
        t.employee_code, t.specialization,
        u.first_name, u.last_name,
        COUNT(CASE WHEN sa.status = 'COMPLETED' THEN 1 END) AS completed_tickets,
        COUNT(CASE WHEN sa.is_current = TRUE AND sa.status IN ('ASSIGNED', 'ACCEPTED') AND sr.status NOT IN ('DELIVERED', 'CANCELLED', 'UNREPAIRABLE') THEN 1 END) AS active_tickets,
        COUNT(CASE WHEN sa.status = 'REJECTED' THEN 1 END) AS rejected_tickets
      FROM technicians t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN service_assignments sa ON sa.technician_id = t.id
      LEFT JOIN service_requests sr ON sr.id = sa.service_request_id
      GROUP BY t.id
      ORDER BY completed_tickets DESC
    `;
    return await query(sql);
  }

  /**
   * Most common hardware and software problems breakdown
   */
  static async getCommonProblems() {
    const sql = `
      SELECT
        d.device_type,
        COUNT(sr.id) AS ticket_count
      FROM service_requests sr
      JOIN devices d ON d.id = sr.device_id
      GROUP BY d.device_type
      ORDER BY ticket_count DESC
    `;
    return await query(sql);
  }

  /**
   * Recent service requests for dashboard table
   */
  static async getRecentRequests(limit = 6) {
    const sql = `
      SELECT sr.id, sr.ticket_number, sr.priority, sr.status, sr.reported_issue, sr.estimated_cost, sr.created_at,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone,
             d.brand, d.model, d.device_type,
             u.first_name AS tech_first_name, u.last_name AS tech_last_name
      FROM service_requests sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id AND sa.is_current = TRUE
      LEFT JOIN technicians t ON t.id = sa.technician_id
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY sr.created_at DESC
      LIMIT ?
    `;
    return await query(sql, [parseInt(limit, 10)]);
  }

  /**
   * Recent customer payments for dashboard table
   */
  static async getRecentPayments(limit = 6) {
    const sql = `
      SELECT p.id, p.payment_reference, p.amount, p.payment_method, p.payment_type, p.payment_date,
             inv.invoice_number,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name
      FROM payments p
      JOIN invoices inv ON inv.id = p.invoice_id
      JOIN customers c ON c.id = inv.customer_id
      ORDER BY p.payment_date DESC
      LIMIT ?
    `;
    return await query(sql, [parseInt(limit, 10)]);
  }
}

module.exports = AnalyticsModel;
