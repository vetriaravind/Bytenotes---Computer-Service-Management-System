/**
 * Inventory & Spare Parts Data Access Model
 * Handles hardware catalog, suppliers, stock purchases, repair part consumption (Scenario 8).
 */

const { query, pool } = require('../config/db');

class InventoryModel {
  /**
   * Add a new spare part to the inventory catalog
   */
  static async createPart(data) {
    const sql = `
      INSERT INTO inventory (
        part_name, part_number, category, supplier_id, cost_price,
        selling_price, quantity_in_stock, reorder_threshold, location_bin, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `;
    const result = await query(sql, [
      data.partName.trim(),
      data.partNumber.trim().toUpperCase(),
      data.category,
      data.supplierId || null,
      parseFloat(data.costPrice) || 0.00,
      parseFloat(data.sellingPrice) || 0.00,
      parseInt(data.quantityInStock, 10) || 0,
      parseInt(data.reorderThreshold, 10) || 3,
      data.locationBin ? data.locationBin.trim() : null
    ]);
    return result.insertId;
  }

  /**
   * List parts with filtering, supplier info, and low stock flags
   */
  static async listParts({ category = '', lowStockOnly = false, search = '', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'i.is_active = TRUE';
    const params = [];

    if (category) {
      whereClause += ' AND i.category = ?';
      params.push(category);
    }

    if (lowStockOnly) {
      whereClause += ' AND i.quantity_in_stock <= i.reorder_threshold';
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause += ' AND (i.part_name LIKE ? OR i.part_number LIKE ? OR i.location_bin LIKE ?)';
      params.push(term, term, term);
    }

    const countSql = `SELECT COUNT(*) AS total FROM inventory i WHERE ${whereClause}`;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    const dataSql = `
      SELECT i.*, s.name AS supplier_name, s.phone AS supplier_phone,
             (i.quantity_in_stock <= i.reorder_threshold) AS is_low_stock
      FROM inventory i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE ${whereClause}
      ORDER BY is_low_stock DESC, i.part_name ASC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      parts: rows
    };
  }

  /**
   * Find part by ID
   */
  static async findById(id) {
    const sql = `
      SELECT i.*, s.name AS supplier_name, s.phone AS supplier_phone, s.contact_person
      FROM inventory i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Record stock purchase / restocking transaction from supplier
   */
  static async restock({ inventoryId, quantity, unitCost, referenceId = null, notes = null, createdBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const qty = parseInt(quantity, 10);
      if (qty <= 0) throw new Error('Quantity must be greater than zero.');

      // 1. Update inventory stock level
      await connection.execute(
        `UPDATE inventory
         SET quantity_in_stock = quantity_in_stock + ?, cost_price = ?
         WHERE id = ?`,
        [qty, parseFloat(unitCost), inventoryId]
      );

      // 2. Insert into stock_transactions audit log
      await connection.execute(
        `INSERT INTO stock_transactions (
          inventory_id, transaction_type, quantity, unit_cost, reference_id, notes, created_by
        ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)`,
        [inventoryId, qty, parseFloat(unitCost), referenceId, notes, createdBy]
      );

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
   * Consume a spare part during a repair job (Real-World Scenario 8)
   * Decrements inventory atomically, creates repair_parts record & logs stock_transactions
   */
  static async consumePartForRepair({ serviceRequestId, inventoryId, quantity = 1, usedBy, notes = null }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const qty = parseInt(quantity, 10) || 1;

      // 1. Lock and check current stock (Prevent negative inventory!)
      const [rows] = await connection.execute(
        'SELECT id, part_name, quantity_in_stock, cost_price, selling_price FROM inventory WHERE id = ? FOR UPDATE',
        [inventoryId]
      );

      if (rows.length === 0) throw new Error(`Inventory item ${inventoryId} not found.`);
      const part = rows[0];

      if (part.quantity_in_stock < qty) {
        throw new Error(
          `Insufficient stock for "${part.part_name}". Available in stock: ${part.quantity_in_stock}, requested: ${qty}. Please replenish stock or mark ticket Waiting for Spare Parts (Scenario 3).`
        );
      }

      // 2. Decrement inventory
      await connection.execute(
        'UPDATE inventory SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?',
        [qty, inventoryId]
      );

      const totalPrice = qty * parseFloat(part.selling_price);

      // 3. Record in repair_parts
      const [repairPartResult] = await connection.execute(
        `INSERT INTO repair_parts (
          service_request_id, inventory_id, quantity, unit_cost, unit_price, total_price, used_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [serviceRequestId, inventoryId, qty, part.cost_price, part.selling_price, totalPrice, usedBy]
      );

      // 4. Record stock transaction audit log
      await connection.execute(
        `INSERT INTO stock_transactions (
          inventory_id, transaction_type, quantity, unit_cost, reference_id, notes, created_by
        ) VALUES (?, 'USED_IN_REPAIR', ?, ?, ?, ?, ?)`,
        [inventoryId, -qty, part.cost_price, `SR-${serviceRequestId}`, notes || `Installed on repair ticket #${serviceRequestId}`, usedBy]
      );

      await connection.commit();
      return {
        repairPartId: repairPartResult.insertId,
        partName: part.part_name,
        quantityUsed: qty,
        remainingStock: part.quantity_in_stock - qty,
        unitPrice: part.selling_price,
        totalPrice
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Record damaged part write-off or customer return
   */
  static async recordAdjustment({ inventoryId, type, quantity, reason, createdBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const qty = parseInt(quantity, 10);
      const [parts] = await connection.execute('SELECT cost_price, quantity_in_stock FROM inventory WHERE id = ? FOR UPDATE', [inventoryId]);
      if (parts.length === 0) throw new Error('Part not found.');
      const part = parts[0];

      let stockDelta = 0;
      if (type === 'DAMAGED_WRITE_OFF') {
        if (part.quantity_in_stock < qty) throw new Error('Cannot write off more items than current stock.');
        stockDelta = -qty;
      } else if (type === 'RETURNED_BY_CUSTOMER') {
        stockDelta = qty;
      } else {
        throw new Error('Invalid adjustment type.');
      }

      await connection.execute('UPDATE inventory SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?', [stockDelta, inventoryId]);

      await connection.execute(
        `INSERT INTO stock_transactions (inventory_id, transaction_type, quantity, unit_cost, reference_id, notes, created_by)
         VALUES (?, ?, ?, ?, 'ADJUSTMENT', ?, ?)`,
        [inventoryId, type, stockDelta, part.cost_price, reason, createdBy]
      );

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
   * Get all parts installed on a specific service request
   */
  static async getPartsUsedOnTicket(serviceRequestId) {
    const sql = `
      SELECT rp.*, i.part_name, i.part_number, i.category,
             u.first_name AS tech_first, u.last_name AS tech_last
      FROM repair_parts rp
      JOIN inventory i ON i.id = rp.inventory_id
      JOIN users u ON u.id = rp.used_by
      WHERE rp.service_request_id = ?
      ORDER BY rp.used_at ASC
    `;
    return await query(sql, [serviceRequestId]);
  }

  /**
   * Get stock movement audit transactions for an item
   */
  static async getTransactionHistory(inventoryId) {
    const sql = `
      SELECT st.*, u.username, u.first_name, u.last_name
      FROM stock_transactions st
      JOIN users u ON u.id = st.created_by
      WHERE st.inventory_id = ?
      ORDER BY st.created_at DESC
    `;
    return await query(sql, [inventoryId]);
  }

  /**
   * Suppliers management
   */
  static async listSuppliers() {
    return await query('SELECT * FROM suppliers WHERE is_active = TRUE ORDER BY name ASC');
  }

  static async createSupplier(data) {
    const sql = `
      INSERT INTO suppliers (name, contact_person, phone, email, address, gst_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.name.trim(),
      data.contactPerson || null,
      data.phone.trim(),
      data.email || null,
      data.address || null,
      data.gstNumber || null
    ]);
    return result.insertId;
  }
}

module.exports = InventoryModel;
