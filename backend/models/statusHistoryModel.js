/**
 * Status History & State Transition Data Access Model
 * Manages atomic lifecycle state transitions and audit logging (Module 6).
 */

const { pool } = require('../config/db');
const { validateStatusTransition } = require('../utils/statusTransitions');

class StatusHistoryModel {
  /**
   * Atomically transition service request status with strict state-machine validation
   */
  static async transitionStatus({
    serviceRequestId,
    targetStatus,
    changedBy,
    remarks = '',
    cancellationReason = null,
    unrepairableReason = null
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch current status of the service ticket
      const [rows] = await connection.execute(
        'SELECT id, status, customer_id, device_id FROM service_requests WHERE id = ? FOR UPDATE',
        [serviceRequestId]
      );

      if (rows.length === 0) {
        throw new Error(`Service request with ID ${serviceRequestId} was not found.`);
      }

      const currentStatus = rows[0].status;

      // 2. Validate state machine transition rules
      const validation = validateStatusTransition(currentStatus, targetStatus);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 3. Validate mandatory scenario parameters
      if (targetStatus === 'CANCELLED' && (!cancellationReason || cancellationReason.trim().length === 0)) {
        throw new Error('A detailed cancellation reason is required to cancel a service request (Scenario 12).');
      }

      if (targetStatus === 'UNREPAIRABLE' && (!unrepairableReason || unrepairableReason.trim().length === 0)) {
        throw new Error('A technical explanation is required when marking a device as unrepairable (Scenario 6).');
      }

      // 4. Update service_requests table
      let updateSql = `UPDATE service_requests SET status = ?`;
      const updateParams = [targetStatus];

      if (targetStatus === 'DELIVERED') {
        updateSql += `, actual_delivery_date = NOW()`;
      }

      if (targetStatus === 'CANCELLED') {
        updateSql += `, cancellation_reason = ?`;
        updateParams.push(cancellationReason.trim());
      }

      if (targetStatus === 'UNREPAIRABLE') {
        updateSql += `, unrepairable_reason = ?`;
        updateParams.push(unrepairableReason.trim());
      }

      updateSql += ` WHERE id = ?`;
      updateParams.push(serviceRequestId);

      await connection.execute(updateSql, updateParams);

      // 5. Append immutable record into status_history audit log
      const historySql = `
        INSERT INTO status_history (
          service_request_id, previous_status, new_status, changed_by, remarks
        ) VALUES (?, ?, ?, ?, ?)
      `;
      await connection.execute(historySql, [
        serviceRequestId,
        currentStatus,
        targetStatus,
        changedBy,
        remarks || `Status transitioned from ${currentStatus} to ${targetStatus}`
      ]);

      // 6. If target status is READY_FOR_DELIVERY, mark current technician assignment as COMPLETED
      if (targetStatus === 'READY_FOR_DELIVERY') {
        await connection.execute(
          `UPDATE service_assignments
           SET status = 'COMPLETED'
           WHERE service_request_id = ? AND is_current = TRUE`,
          [serviceRequestId]
        );
      }

      await connection.commit();
      return {
        previousStatus: currentStatus,
        newStatus: targetStatus
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = StatusHistoryModel;
