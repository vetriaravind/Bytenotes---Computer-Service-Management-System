/**
 * Technician Data Access Model
 * Manages technician profiles, workload limits, assignments & reassignments (Module 5).
 */

const { query, pool } = require('../config/db');

class TechnicianModel {
  /**
   * List all technicians with real-time active workload counts
   */
  static async listWithWorkload({ status = '', specialization = '' } = {}) {
    let whereClause = 'u.is_active = TRUE';
    const params = [];

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    if (specialization) {
      whereClause += ' AND t.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }

    const sql = `
      SELECT t.id, t.user_id, t.employee_code, t.specialization,
             t.experience_years, t.max_active_tickets, t.status,
             u.first_name, u.last_name, u.email, u.phone,
             COUNT(CASE WHEN sa.is_current = TRUE AND sa.status IN ('ASSIGNED', 'ACCEPTED') AND sr.status NOT IN ('READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'UNREPAIRABLE') THEN 1 END) AS active_ticket_count
      FROM technicians t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN service_assignments sa ON sa.technician_id = t.id
      LEFT JOIN service_requests sr ON sr.id = sa.service_request_id
      WHERE ${whereClause}
      GROUP BY t.id
      ORDER BY active_ticket_count ASC, t.experience_years DESC
    `;
    return await query(sql, params);
  }

  /**
   * Smart Workload Load Balancer: finds technician with lowest active workload who is AVAILABLE and below capacity
   */
  static async getLeastLoadedTechnician() {
    const list = await this.listWithWorkload({ status: 'AVAILABLE' });
    const available = list.filter((t) => t.active_ticket_count < t.max_active_tickets);
    if (available.length === 0) return null;
    // Sort by ratio of active tickets to max capacity, then absolute active count
    available.sort((a, b) => {
      const ratioA = a.active_ticket_count / a.max_active_tickets;
      const ratioB = b.active_ticket_count / b.max_active_tickets;
      if (ratioA !== ratioB) return ratioA - ratioB;
      return a.active_ticket_count - b.active_ticket_count;
    });
    return available[0];
  }

  /**
   * Find technician profile by primary key ID
   */
  static async findById(id) {
    const sql = `
      SELECT t.*, u.first_name, u.last_name, u.email, u.phone, u.username, u.is_active,
             COUNT(CASE WHEN sa.is_current = TRUE AND sa.status IN ('ASSIGNED', 'ACCEPTED') AND sr.status NOT IN ('READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'UNREPAIRABLE') THEN 1 END) AS active_ticket_count
      FROM technicians t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN service_assignments sa ON sa.technician_id = t.id
      LEFT JOIN service_requests sr ON sr.id = sa.service_request_id
      WHERE t.id = ?
      GROUP BY t.id
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Find technician profile by users.id
   */
  static async findByUserId(userId) {
    const sql = `
      SELECT t.*, u.first_name, u.last_name, u.email, u.phone
      FROM technicians t
      JOIN users u ON u.id = t.user_id
      WHERE t.user_id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [userId]);
    return rows[0] || null;
  }

  /**
   * Assign or Reassign a service ticket to a technician using a transaction (Scenarios 2 & 14)
   */
  static async assignTicket({ serviceRequestId, technicianId, assignedBy, notes = null }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Verify technician capacity
      const [techRows] = await connection.execute(
        `SELECT t.*,
                COUNT(CASE WHEN sa.is_current = TRUE AND sa.status IN ('ASSIGNED', 'ACCEPTED') AND sr.status NOT IN ('READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'UNREPAIRABLE') THEN 1 END) AS active_count
         FROM technicians t
         LEFT JOIN service_assignments sa ON sa.technician_id = t.id
         LEFT JOIN service_requests sr ON sr.id = sa.service_request_id
         WHERE t.id = ? GROUP BY t.id`,
        [technicianId]
      );

      if (techRows.length === 0) {
        throw new Error(`Technician with ID ${technicianId} not found.`);
      }

      const tech = techRows[0];
      if (tech.active_count >= tech.max_active_tickets) {
        throw new Error(
          `Workload limit reached: Technician ${tech.employee_code} already has ${tech.active_count} active tickets (Maximum allowed: ${tech.max_active_tickets}). Please assign to another technician.`
        );
      }

      // 2. If already assigned to another technician, mark previous assignment as TRANSFERRED (Scenario 14)
      await connection.execute(
        `UPDATE service_assignments
         SET is_current = FALSE, status = 'TRANSFERRED'
         WHERE service_request_id = ? AND is_current = TRUE`,
        [serviceRequestId]
      );

      // 3. Create new service assignment
      const insertSql = `
        INSERT INTO service_assignments (
          service_request_id, technician_id, assigned_by, status, technician_notes, is_current
        ) VALUES (?, ?, ?, 'ASSIGNED', ?, TRUE)
      `;
      const [assignResult] = await connection.execute(insertSql, [
        serviceRequestId,
        technicianId,
        assignedBy,
        notes
      ]);

      // 4. Update technician status to BUSY if capacity reached
      if (tech.active_count + 1 >= tech.max_active_tickets) {
        await connection.execute(`UPDATE technicians SET status = 'BUSY' WHERE id = ?`, [technicianId]);
      }

      await connection.commit();
      return assignResult.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Technician accepts or rejects assigned job
   */
  static async respondToAssignment({ assignmentId, technicianId, responseStatus, technicianNotes = null, rejectionReason = null, userId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch current assignment
      const [assignments] = await connection.execute(
        `SELECT sa.*, sr.status AS request_status
         FROM service_assignments sa
         JOIN service_requests sr ON sr.id = sa.service_request_id
         WHERE sa.id = ? AND sa.technician_id = ? AND sa.is_current = TRUE`,
        [assignmentId, technicianId]
      );

      if (assignments.length === 0) {
        throw new Error('Assignment not found or you are not authorized to respond to this assignment.');
      }

      const assignment = assignments[0];

      if (responseStatus === 'ACCEPTED') {
        // Update assignment
        await connection.execute(
          `UPDATE service_assignments
           SET status = 'ACCEPTED', technician_notes = ?
           WHERE id = ?`,
          [technicianNotes || 'Assignment accepted by technician.', assignmentId]
        );

        // If request is still in RECEIVED status, automatically advance to UNDER_DIAGNOSIS
        if (assignment.request_status === 'RECEIVED') {
          await connection.execute(
            `UPDATE service_requests SET status = 'UNDER_DIAGNOSIS' WHERE id = ?`,
            [assignment.service_request_id]
          );

          await connection.execute(
            `INSERT INTO status_history (
              service_request_id, previous_status, new_status, changed_by, remarks
            ) VALUES (?, 'RECEIVED', 'UNDER_DIAGNOSIS', ?, 'Technician accepted job. Diagnosis commenced.')`,
            [assignment.service_request_id, userId]
          );
        }
      } else if (responseStatus === 'REJECTED') {
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new Error('A valid rejection reason is required when rejecting an assignment.');
        }

        await connection.execute(
          `UPDATE service_assignments
           SET status = 'REJECTED', is_current = FALSE, rejection_reason = ?
           WHERE id = ?`,
          [rejectionReason.trim(), assignmentId]
        );

        // Record in status_history that technician declined
        await connection.execute(
          `INSERT INTO status_history (
            service_request_id, previous_status, new_status, changed_by, remarks
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            assignment.service_request_id,
            assignment.request_status,
            assignment.request_status,
            userId,
            `Assignment rejected by technician: "${rejectionReason.trim()}". Needs reassignment by Admin.`
          ]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get paginated workbench jobs assigned to a technician
   */
  static async getTechnicianWorkbench(technicianId, { status = '', page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'sa.technician_id = ? AND sa.is_current = TRUE';
    const params = [technicianId];

    if (status) {
      whereClause += ' AND sr.status = ?';
      params.push(status);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM service_assignments sa
      JOIN service_requests sr ON sr.id = sa.service_request_id
      WHERE ${whereClause}
    `;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    const dataSql = `
      SELECT sa.id AS assignment_id, sa.status AS assignment_status, sa.assigned_at, sa.technician_notes,
             sr.id AS request_id, sr.ticket_number, sr.priority, sr.status AS request_status,
             sr.reported_issue, sr.expected_delivery_date, sr.created_at AS intake_date,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone,
             d.device_type, d.brand, d.model, d.serial_number, d.physical_condition, d.password_pin
      FROM service_assignments sa
      JOIN service_requests sr ON sr.id = sa.service_request_id
      JOIN customers c ON c.id = sr.customer_id
      JOIN devices d ON d.id = sr.device_id
      WHERE ${whereClause}
      ORDER BY
        CASE sr.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        sr.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      jobs: rows
    };
  }

  /**
   * Get assignment history for a ticket (tracks multiple technicians working on one ticket - Scenario 14)
   */
  static async getAssignmentHistory(serviceRequestId) {
    const sql = `
      SELECT sa.*,
             t.employee_code, t.specialization,
             tu.first_name AS tech_first_name, tu.last_name AS tech_last_name,
             au.first_name AS assigner_first_name, au.last_name AS assigner_last_name
      FROM service_assignments sa
      JOIN technicians t ON t.id = sa.technician_id
      JOIN users tu ON tu.id = t.user_id
      JOIN users au ON au.id = sa.assigned_by
      WHERE sa.service_request_id = ?
      ORDER BY sa.assigned_at DESC
    `;
    return await query(sql, [serviceRequestId]);
  }

  /**
   * Performance metrics for a technician
   */
  static async getMetrics(technicianId) {
    const sql = `
      SELECT
        COUNT(DISTINCT CASE WHEN sa.status = 'COMPLETED' THEN sa.service_request_id END) AS completed_jobs,
        COUNT(DISTINCT CASE WHEN sa.is_current = TRUE AND sa.status IN ('ASSIGNED', 'ACCEPTED') AND sr.status NOT IN ('DELIVERED', 'CANCELLED', 'UNREPAIRABLE') THEN sa.service_request_id END) AS active_jobs,
        COUNT(DISTINCT CASE WHEN sa.status = 'REJECTED' THEN sa.id END) AS rejected_assignments,
        AVG(CASE WHEN sr.actual_delivery_date IS NOT NULL THEN TIMESTAMPDIFF(HOUR, sr.created_at, sr.actual_delivery_date) END) AS avg_turnaround_hours
      FROM service_assignments sa
      JOIN service_requests sr ON sr.id = sa.service_request_id
      WHERE sa.technician_id = ?
    `;
    const rows = await query(sql, [technicianId]);
    return rows[0] || { completed_jobs: 0, active_jobs: 0, rejected_assignments: 0, avg_turnaround_hours: 0 };
  }

  /**
   * Create a new technician profile and linked user account
   */
  static async createTechnician(techData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(techData.password || 'Password@123', salt);

      const [userResult] = await connection.execute(
        `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active)
         VALUES (?, ?, ?, 'TECHNICIAN', ?, ?, ?, TRUE)`,
        [techData.username, techData.email, passwordHash, techData.firstName, techData.lastName, techData.phone]
      );
      const userId = userResult.insertId;

      const [techResult] = await connection.execute(
        `INSERT INTO technicians (user_id, employee_code, specialization, experience_years, max_active_tickets, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          techData.employeeCode,
          techData.specialization || 'Hardware Diagnostic & Component Repair',
          parseInt(techData.experienceYears, 10) || 1,
          parseInt(techData.maxActiveTickets, 10) || 5,
          techData.status || 'AVAILABLE'
        ]
      );

      await connection.commit();
      return techResult.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update technician and user details
   */
  static async updateTechnician(id, data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [techRows] = await connection.execute('SELECT * FROM technicians WHERE id = ?', [id]);
      if (techRows.length === 0) throw new Error('Technician not found');
      const tech = techRows[0];

      await connection.execute(
        `UPDATE technicians SET
           employee_code = ?,
           specialization = ?,
           experience_years = ?,
           max_active_tickets = ?,
           status = ?
         WHERE id = ?`,
        [
          data.employeeCode || tech.employee_code,
          data.specialization !== undefined ? data.specialization : tech.specialization,
          data.experienceYears !== undefined ? parseInt(data.experienceYears, 10) : tech.experience_years,
          data.maxActiveTickets !== undefined ? parseInt(data.maxActiveTickets, 10) : tech.max_active_tickets,
          data.status || tech.status,
          id
        ]
      );

      if (data.firstName || data.lastName || data.phone || data.email) {
        await connection.execute(
          `UPDATE users SET
             first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             email = COALESCE(?, email)
           WHERE id = ?`,
          [data.firstName || null, data.lastName || null, data.phone || null, data.email || null, tech.user_id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Deactivate technician account
   */
  static async deleteTechnician(id) {
    const tech = await TechnicianModel.findById(id);
    if (!tech) throw new Error('Technician not found');
    await query('UPDATE technicians SET status = "INACTIVE" WHERE id = ?', [id]);
    await query('UPDATE users SET is_active = FALSE WHERE id = ?', [tech.user_id]);
    return true;
  }
}

module.exports = TechnicianModel;
