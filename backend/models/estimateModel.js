/**
 * Repair Estimate & Quotation Data Access Model
 * Manages pricing, versioning, spare parts quotations & customer approval gates (Module 7).
 */

const { query, pool } = require('../config/db');

class EstimateModel {
  /**
   * Create an initial or revised repair estimate with line items using a MySQL transaction (Scenario 5)
   */
  static async createEstimate({
    serviceRequestId,
    labourCharge = 0.00,
    items = [],
    createdBy,
    notes = null
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch existing estimates for this ticket to determine versioning
      const [existingEstimates] = await connection.execute(
        `SELECT id, version_number, status
         FROM repair_estimates
         WHERE service_request_id = ?
         ORDER BY version_number DESC`,
        [serviceRequestId]
      );

      let nextVersion = 1;

      if (existingEstimates.length > 0) {
        nextVersion = existingEstimates[0].version_number + 1;

        // Mark any previous PENDING or non-superseded estimates as SUPERSEDED (Scenario 5)
        await connection.execute(
          `UPDATE repair_estimates
           SET status = 'SUPERSEDED'
           WHERE service_request_id = ? AND status IN ('PENDING', 'APPROVED')`,
          [serviceRequestId]
        );
      }

      // 2. Calculate parts total and item totals
      let partsTotal = 0.00;
      const parsedItems = items.map((item) => {
        const qty = parseInt(item.quantity, 10) || 1;
        const unitPrice = parseFloat(item.unitPrice) || 0.00;
        const totalPrice = qty * unitPrice;

        if (item.itemType === 'PART') {
          partsTotal += totalPrice;
        }

        return {
          inventoryId: item.inventoryId || null,
          description: item.description.trim(),
          itemType: item.itemType || 'PART',
          quantity: qty,
          unitPrice,
          totalPrice
        };
      });

      const parsedLabour = parseFloat(labourCharge) || 0.00;
      const subtotal = partsTotal + parsedLabour;
      // 18% standard GST tax rate
      const taxRate = 0.18;
      const taxAmount = parseFloat((subtotal * taxRate).toFixed(2));
      const totalEstimate = parseFloat((subtotal + taxAmount).toFixed(2));

      // 3. Insert repair_estimate header
      const estimateSql = `
        INSERT INTO repair_estimates (
          service_request_id, version_number, labour_charge, parts_total,
          tax_amount, total_estimate, status, customer_notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `;
      const [estimateResult] = await connection.execute(estimateSql, [
        serviceRequestId,
        nextVersion,
        parsedLabour,
        partsTotal,
        taxAmount,
        totalEstimate,
        notes,
        createdBy
      ]);

      const estimateId = estimateResult.insertId;

      // 4. Insert granular line items into estimate_items
      if (parsedItems.length > 0) {
        const itemSql = `
          INSERT INTO estimate_items (
            estimate_id, inventory_id, description, item_type, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        for (const it of parsedItems) {
          await connection.execute(itemSql, [
            estimateId,
            it.inventoryId,
            it.description,
            it.itemType,
            it.quantity,
            it.unitPrice,
            it.totalPrice
          ]);
        }
      }

      // 5. Update service request status to WAITING_FOR_CUSTOMER_APPROVAL
      const [currentReq] = await connection.execute(
        'SELECT status FROM service_requests WHERE id = ?',
        [serviceRequestId]
      );
      const prevStatus = currentReq[0] ? currentReq[0].status : 'UNDER_DIAGNOSIS';

      await connection.execute(
        `UPDATE service_requests
         SET status = 'WAITING_FOR_CUSTOMER_APPROVAL', estimated_cost = ?
         WHERE id = ?`,
        [totalEstimate, serviceRequestId]
      );

      // 6. Append audit log in status_history
      await connection.execute(
        `INSERT INTO status_history (
          service_request_id, previous_status, new_status, changed_by, remarks
        ) VALUES (?, ?, 'WAITING_FOR_CUSTOMER_APPROVAL', ?, ?)`,
        [
          serviceRequestId,
          prevStatus,
          createdBy,
          `Repair Estimate Version ${nextVersion} generated for ₹${totalEstimate.toFixed(2)} (Labour: ₹${parsedLabour}, Parts: ₹${partsTotal}, Tax: ₹${taxAmount}). Awaiting customer authorization.`
        ]
      );

      await connection.commit();
      return {
        estimateId,
        versionNumber: nextVersion,
        subtotal,
        taxAmount,
        totalEstimate
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Find single estimate by ID with all itemized line items
   */
  static async findByIdWithItems(estimateId) {
    const headerSql = `
      SELECT re.*,
             sr.ticket_number, sr.customer_id, sr.status AS request_status,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone,
             u.first_name AS created_by_first, u.last_name AS created_by_last
      FROM repair_estimates re
      JOIN service_requests sr ON sr.id = re.service_request_id
      JOIN customers c ON c.id = sr.customer_id
      JOIN users u ON u.id = re.created_by
      WHERE re.id = ?
      LIMIT 1
    `;
    const headers = await query(headerSql, [estimateId]);
    if (headers.length === 0) return null;

    const estimate = headers[0];

    const itemsSql = `
      SELECT ei.*, inv.part_name, inv.part_number, inv.quantity_in_stock
      FROM estimate_items ei
      LEFT JOIN inventory inv ON inv.id = ei.inventory_id
      WHERE ei.estimate_id = ?
      ORDER BY ei.item_type DESC, ei.id ASC
    `;
    const items = await query(itemsSql, [estimateId]);

    estimate.items = items;
    return estimate;
  }

  /**
   * Get all estimate versions for a service ticket (Scenario 5)
   */
  static async getHistoryByTicket(serviceRequestId) {
    const sql = `
      SELECT re.*, u.first_name AS created_by_first, u.last_name AS created_by_last,
             COUNT(ei.id) AS total_items
      FROM repair_estimates re
      JOIN users u ON u.id = re.created_by
      LEFT JOIN estimate_items ei ON ei.estimate_id = re.id
      WHERE re.service_request_id = ?
      GROUP BY re.id
      ORDER BY re.version_number DESC
    `;
    return await query(sql, [serviceRequestId]);
  }

  /**
   * Customer approves or rejects an estimate (Scenario 4 & 5)
   */
  static async respondToEstimate({
    estimateId,
    action, // 'APPROVE' or 'REJECT'
    customerNotes = null,
    rejectionReason = null,
    userId
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch estimate
      const [estimates] = await connection.execute(
        `SELECT re.*, sr.customer_id, sr.status AS request_status, c.user_id AS customer_user_id
         FROM repair_estimates re
         JOIN service_requests sr ON sr.id = re.service_request_id
         JOIN customers c ON c.id = sr.customer_id
         WHERE re.id = ? FOR UPDATE`,
        [estimateId]
      );

      if (estimates.length === 0) {
        throw new Error(`Estimate ID ${estimateId} not found.`);
      }

      const estimate = estimates[0];

      if (estimate.status !== 'PENDING') {
        throw new Error(`Cannot respond to estimate. This quotation is already in "${estimate.status}" status.`);
      }

      const changerId = userId || estimate.customer_user_id || estimate.created_by;

      if (action === 'APPROVE') {
        // Customer APPROVES quotation:
        // Update estimate record
        await connection.execute(
          `UPDATE repair_estimates
           SET status = 'APPROVED', response_date = NOW(), customer_notes = ?
           WHERE id = ?`,
          [customerNotes || 'Estimate approved by customer.', estimateId]
        );

        // Advance service request to IN_PROGRESS (Authorizes technician to begin repair)
        await connection.execute(
          `UPDATE service_requests
           SET status = 'IN_PROGRESS', estimated_cost = ?
           WHERE id = ?`,
          [estimate.total_estimate, estimate.service_request_id]
        );

        // Audit log in status_history
        await connection.execute(
          `INSERT INTO status_history (
            service_request_id, previous_status, new_status, changed_by, remarks
          ) VALUES (?, 'WAITING_FOR_CUSTOMER_APPROVAL', 'IN_PROGRESS', ?, ?)`,
          [
            estimate.service_request_id,
            changerId,
            `Customer approved Estimate v${estimate.version_number} of ₹${parseFloat(estimate.total_estimate).toFixed(2)}. Authorized repair work commenced.`
          ]
        );
      } else if (action === 'REJECT') {
        // Customer REJECTS quotation (Scenario 4):
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new Error('A rejection reason is required when declining a repair quotation (Scenario 4).');
        }

        // Update estimate record
        await connection.execute(
          `UPDATE repair_estimates
           SET status = 'REJECTED', response_date = NOW(), rejection_reason = ?
           WHERE id = ?`,
          [rejectionReason.trim(), estimateId]
        );

        // Cancel service request
        await connection.execute(
          `UPDATE service_requests
           SET status = 'CANCELLED', cancellation_reason = ?
           WHERE id = ?`,
          [`Estimate rejected by customer: ${rejectionReason.trim()}`, estimate.service_request_id]
        );

        // Audit log in status_history
        await connection.execute(
          `INSERT INTO status_history (
            service_request_id, previous_status, new_status, changed_by, remarks
          ) VALUES (?, 'WAITING_FOR_CUSTOMER_APPROVAL', 'CANCELLED', ?, ?)`,
          [
            estimate.service_request_id,
            changerId,
            `Customer rejected Estimate v${estimate.version_number}. Reason: "${rejectionReason.trim()}". Repair halted and ticket cancelled.`
          ]
        );
      } else {
        throw new Error('Invalid action. Must be either "APPROVE" or "REJECT".');
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
}

module.exports = EstimateModel;
