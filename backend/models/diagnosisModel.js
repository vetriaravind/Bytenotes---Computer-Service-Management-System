/**
 * Diagnosis Report Data Access Model
 * Handles technical findings, root cause analysis & labour estimations (Module 7).
 */

const { query, pool } = require('../config/db');

class DiagnosisModel {
  /**
   * Save or update technical diagnosis report
   */
  static async saveDiagnosis({
    serviceRequestId,
    technicianId,
    findings,
    rootCause,
    recommendedAction,
    estimatedHours = 1.0,
    estimatedLabourCost = 0.00
  }) {
    // Check if diagnosis report already exists for this ticket
    const existing = await this.findByServiceRequestId(serviceRequestId);

    if (existing) {
      const sql = `
        UPDATE diagnosis_reports SET
          technician_id = ?,
          findings = ?,
          root_cause = ?,
          recommended_action = ?,
          estimated_hours = ?,
          estimated_labour_cost = ?
        WHERE id = ?
      `;
      await query(sql, [
        technicianId,
        findings.trim(),
        rootCause.trim(),
        recommendedAction.trim(),
        parseFloat(estimatedHours) || 1.0,
        parseFloat(estimatedLabourCost) || 0.00,
        existing.id
      ]);
      return existing.id;
    } else {
      const sql = `
        INSERT INTO diagnosis_reports (
          service_request_id, technician_id, findings, root_cause,
          recommended_action, estimated_hours, estimated_labour_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await query(sql, [
        serviceRequestId,
        technicianId,
        findings.trim(),
        rootCause.trim(),
        recommendedAction.trim(),
        parseFloat(estimatedHours) || 1.0,
        parseFloat(estimatedLabourCost) || 0.00
      ]);
      return result.insertId;
    }
  }

  /**
   * Find diagnosis report by service request ID
   */
  static async findByServiceRequestId(serviceRequestId) {
    const sql = `
      SELECT dr.*,
             t.employee_code, t.specialization,
             u.first_name AS tech_first_name, u.last_name AS tech_last_name
      FROM diagnosis_reports dr
      JOIN technicians t ON t.id = dr.technician_id
      JOIN users u ON u.id = t.user_id
      WHERE dr.service_request_id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [serviceRequestId]);
    return rows[0] || null;
  }
}

module.exports = DiagnosisModel;
