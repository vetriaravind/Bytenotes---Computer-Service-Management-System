/**
 * Device Data Access Model
 * Handles parameterized SQL operations for Device Management & Intake Evidence (Module 3).
 */

const { query } = require('../config/db');
const { encryptPin, decryptPin, maskPin } = require('../utils/cryptoUtils');

class DeviceModel {
  /**
   * Register a new device under a customer (PIN encrypted at rest)
   */
  static async createDevice(deviceData) {
    const encryptedPin = deviceData.passwordPin ? encryptPin(deviceData.passwordPin.trim()) : null;

    const sql = `
      INSERT INTO devices (
        customer_id, device_type, brand, model, serial_number,
        processor, ram, storage, operating_system,
        physical_condition, accessories_received, password_pin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      deviceData.customerId,
      deviceData.deviceType,
      deviceData.brand.trim(),
      deviceData.model.trim(),
      deviceData.serialNumber.trim(),
      deviceData.processor ? deviceData.processor.trim() : null,
      deviceData.ram ? deviceData.ram.trim() : null,
      deviceData.storage ? deviceData.storage.trim() : null,
      deviceData.operatingSystem ? deviceData.operatingSystem.trim() : null,
      deviceData.physicalCondition ? deviceData.physicalCondition.trim() : 'No visible physical damage',
      deviceData.accessoriesReceived ? deviceData.accessoriesReceived.trim() : 'Device only (no accessories)',
      encryptedPin
    ]);
    return result.insertId;
  }

  /**
   * Find device by primary key ID with owner details
   */
  static async findById(id) {
    const sql = `
      SELECT d.*,
             c.first_name AS customer_first_name,
             c.last_name AS customer_last_name,
             c.phone AS customer_phone,
             c.email AS customer_email,
             COUNT(DISTINCT sr.id) AS service_history_count
      FROM devices d
      JOIN customers c ON c.id = d.customer_id
      LEFT JOIN service_requests sr ON sr.device_id = d.id
      WHERE d.id = ?
      GROUP BY d.id
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    if (!rows[0]) return null;
    const device = rows[0];
    device.masked_pin = device.password_pin ? maskPin(device.password_pin) : null;
    device.decrypted_pin = device.password_pin ? decryptPin(device.password_pin) : null;
    return device;
  }

  /**
   * List devices with optional filtering by customerId, search, and pagination
   */
  static async listDevices({ customerId = null, search = '', limit = 50, page = 1 } = {}) {
    let whereClause = '1 = 1';
    const params = [];

    if (customerId) {
      whereClause += ' AND d.customer_id = ?';
      params.push(customerId);
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause += ' AND (d.serial_number LIKE ? OR d.brand LIKE ? OR d.model LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
      params.push(term, term, term, term, term);
    }

    const countSql = `SELECT COUNT(*) AS total FROM devices d JOIN customers c ON c.id = d.customer_id WHERE ${whereClause}`;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    const offset = (page - 1) * limit;
    const sql = `
      SELECT d.*,
             c.first_name AS customer_first_name,
             c.last_name AS customer_last_name,
             c.phone AS customer_phone,
             c.email AS customer_email
      FROM devices d
      JOIN customers c ON c.id = d.customer_id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      devices: rows
    };
  }

  /**
   * Find existing devices by hardware serial number (Real-World Scenario 1)
   */
  static async findBySerialNumber(serialNumber) {
    const sql = `
      SELECT d.*, c.first_name, c.last_name, c.phone
      FROM devices d
      JOIN customers c ON c.id = d.customer_id
      WHERE d.serial_number = ?
    `;
    return await query(sql, [serialNumber.trim()]);
  }

  /**
   * Update device hardware specifications or intake notes
   */
  static async updateDevice(id, data) {
    const encryptedPin = data.passwordPin !== undefined
      ? (data.passwordPin ? encryptPin(data.passwordPin.trim()) : null)
      : undefined;

    let pinValue = encryptedPin;
    if (pinValue === undefined) {
      // keep existing pin
      const curr = await DeviceModel.findById(id);
      pinValue = curr ? curr.password_pin : null;
    }

    const sql = `
      UPDATE devices SET
        device_type = ?,
        brand = ?,
        model = ?,
        serial_number = ?,
        processor = ?,
        ram = ?,
        storage = ?,
        operating_system = ?,
        physical_condition = ?,
        accessories_received = ?,
        password_pin = ?
      WHERE id = ?
    `;
    await query(sql, [
      data.deviceType,
      data.brand.trim(),
      data.model.trim(),
      data.serialNumber.trim(),
      data.processor ? data.processor.trim() : null,
      data.ram ? data.ram.trim() : null,
      data.storage ? data.storage.trim() : null,
      data.operatingSystem ? data.operatingSystem.trim() : null,
      data.physicalCondition ? data.physicalCondition.trim() : null,
      data.accessoriesReceived ? data.accessoriesReceived.trim() : null,
      pinValue,
      id
    ]);
  }

  /**
   * Store intake photo metadata for dispute protection (Real-World Scenario 11)
   */
  static async addAttachment({ deviceId, serviceRequestId = null, fileName, filePath, fileType, caption = null, uploadedBy }) {
    const sql = `
      INSERT INTO device_attachments (
        device_id, service_request_id, file_name, file_path, file_type, caption, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      deviceId,
      serviceRequestId,
      fileName,
      filePath,
      fileType,
      caption,
      uploadedBy
    ]);
    return result.insertId;
  }

  /**
   * Get all intake condition photographs for a device
   */
  static async getAttachments(deviceId) {
    const sql = `
      SELECT da.*, u.username AS uploaded_by_username, u.first_name, u.last_name
      FROM device_attachments da
      JOIN users u ON u.id = da.uploaded_by
      WHERE da.device_id = ?
      ORDER BY da.created_at DESC
    `;
    return await query(sql, [deviceId]);
  }

  /**
   * Get complete multi-visit repair timeline for this hardware device (Scenario 1)
   */
  static async getRepairHistory(deviceId) {
    const sql = `
      SELECT sr.id AS request_id, sr.ticket_number, sr.priority, sr.status,
             sr.reported_issue, sr.estimated_cost, sr.final_cost,
             sr.created_at, sr.actual_delivery_date,
             u.first_name AS created_by_first, u.last_name AS created_by_last,
             dr.findings, dr.root_cause, dr.recommended_action,
             w.warranty_code, w.status AS warranty_status, w.expiry_date AS warranty_expiry
      FROM service_requests sr
      JOIN users u ON u.id = sr.created_by
      LEFT JOIN diagnosis_reports dr ON dr.service_request_id = sr.id
      LEFT JOIN warranties w ON w.service_request_id = sr.id
      WHERE sr.device_id = ?
      ORDER BY sr.created_at DESC
    `;
    return await query(sql, [deviceId]);
  }
}

module.exports = DeviceModel;
