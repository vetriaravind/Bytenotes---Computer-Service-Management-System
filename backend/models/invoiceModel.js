/**
 * Invoice & Payments Data Access Model
 * Manages billing, GST tax calculation, partial payments & downloadable statements (Module 9).
 */

const { query, pool } = require('../config/db');
const PdfService = require('../services/pdfService');

class InvoiceModel {
  /**
   * Generate sequential invoice number: INV-YYYYMM-XXXX
   */
  static async generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const sql = `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`;
    const rows = await query(sql, [`${prefix}%`]);

    let seq = 1;
    if (rows.length > 0 && rows[0].invoice_number) {
      const parts = rows[0].invoice_number.split('-');
      if (parts.length === 3) {
        const last = parseInt(parts[2], 10);
        if (!isNaN(last)) seq = last + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Generate sequential payment reference: PAY-YYYYMM-XXXX
   */
  static async generatePaymentReference() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PAY-${year}${month}-`;

    const sql = `SELECT payment_reference FROM payments WHERE payment_reference LIKE ? ORDER BY id DESC LIMIT 1`;
    const rows = await query(sql, [`${prefix}%`]);

    let seq = 1;
    if (rows.length > 0 && rows[0].payment_reference) {
      const parts = rows[0].payment_reference.split('-');
      if (parts.length === 3) {
        const last = parseInt(parts[2], 10);
        if (!isNaN(last)) seq = last + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Generate invoice from service request and installed parts/labour
   */
  static async createInvoice({ serviceRequestId, customerId, discountAmount = 0.00, taxRate = 18.00, items = [], createdBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check if invoice already exists for this ticket
      const [existing] = await connection.execute('SELECT id, invoice_number FROM invoices WHERE service_request_id = ?', [serviceRequestId]);
      if (existing.length > 0) {
        throw new Error(`Invoice ${existing[0].invoice_number} already exists for this service request.`);
      }

      const invoiceNumber = await this.generateInvoiceNumber();

      // Calculate totals
      let subtotal = 0.00;
      const parsedItems = items.map((it) => {
        const qty = parseInt(it.quantity, 10) || 1;
        const price = parseFloat(it.unitPrice) || 0.00;
        const total = qty * price;
        subtotal += total;
        return {
          description: it.description.trim(),
          itemType: it.itemType || 'LABOUR',
          quantity: qty,
          unitPrice: price,
          totalPrice: total
        };
      });

      const parsedDiscount = parseFloat(discountAmount) || 0.00;
      const taxableAmount = Math.max(0, subtotal - parsedDiscount);
      const parsedTaxRate = parseFloat(taxRate) || 18.00;
      const taxAmount = parseFloat(((taxableAmount * parsedTaxRate) / 100).toFixed(2));
      const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));
      const balanceAmount = totalAmount;

      const invoiceDate = new Date().toISOString().slice(0, 10);

      // Insert invoice header
      const insertSql = `
        INSERT INTO invoices (
          invoice_number, service_request_id, customer_id, subtotal, discount_amount,
          tax_rate, tax_amount, total_amount, paid_amount, balance_amount, payment_status,
          invoice_date, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', ?, ?)
      `;
      const [invResult] = await connection.execute(insertSql, [
        invoiceNumber,
        serviceRequestId,
        customerId,
        subtotal,
        parsedDiscount,
        parsedTaxRate,
        taxAmount,
        totalAmount,
        balanceAmount,
        invoiceDate,
        createdBy
      ]);

      const invoiceId = invResult.insertId;

      // Insert line items
      for (const it of parsedItems) {
        await connection.execute(
          `INSERT INTO invoice_items (invoice_id, description, item_type, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [invoiceId, it.description, it.itemType, it.quantity, it.unitPrice, it.totalPrice]
        );
      }

      // Update service request final cost
      await connection.execute('UPDATE service_requests SET final_cost = ? WHERE id = ?', [totalAmount, serviceRequestId]);

      await connection.commit();

      // Generate invoice HTML/PDF statement
      const invoiceData = await this.findByIdWithDetails(invoiceId);
      const pdfPath = await PdfService.generateInvoiceFile(invoiceData);
      await query('UPDATE invoices SET pdf_path = ? WHERE id = ?', [pdfPath, invoiceId]);

      invoiceData.pdf_path = pdfPath;
      return invoiceData;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Record payment (advance, partial, final settlement - Scenario 7)
   */
  static async addPayment({ invoiceId, amount, paymentMethod, transactionId = null, paymentType = 'FINAL_SETTLEMENT', notes = null, receivedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [invRows] = await connection.execute('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
      if (invRows.length === 0) throw new Error(`Invoice with ID ${invoiceId} not found.`);
      const invoice = invRows[0];

      const paymentAmount = parseFloat(amount);
      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero.');

      const currentBalance = parseFloat(invoice.balance_amount);
      if (paymentAmount > currentBalance) {
        throw new Error(`Payment amount (₹${paymentAmount}) exceeds current pending balance (₹${currentBalance}).`);
      }

      const paymentRef = await this.generatePaymentReference();

      // 1. Record payment transaction
      await connection.execute(
        `INSERT INTO payments (
          payment_reference, invoice_id, amount, payment_method, transaction_id, payment_type, notes, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentRef, invoiceId, paymentAmount, paymentMethod, transactionId, paymentType, notes, receivedBy]
      );

      // 2. Update invoice balance and paid amount
      const newPaid = parseFloat(invoice.paid_amount) + paymentAmount;
      const newBalance = currentBalance - paymentAmount;
      const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

      await connection.execute(
        `UPDATE invoices
         SET paid_amount = ?, balance_amount = ?, payment_status = ?
         WHERE id = ?`,
        [newPaid, newBalance, newStatus, invoiceId]
      );

      await connection.commit();

      // Re-generate updated PDF invoice
      const updatedInvoice = await this.findByIdWithDetails(invoiceId);
      const pdfPath = await PdfService.generateInvoiceFile(updatedInvoice);
      await query('UPDATE invoices SET pdf_path = ? WHERE id = ?', [pdfPath, invoiceId]);

      return {
        paymentReference: paymentRef,
        amountPaid: paymentAmount,
        totalPaid: newPaid,
        remainingBalance: newBalance,
        paymentStatus: newStatus,
        invoice: updatedInvoice
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Find invoice by ID with complete items and payment history
   */
  static async findByIdWithDetails(invoiceId) {
    const headerSql = `
      SELECT inv.*,
             sr.ticket_number, sr.status AS request_status,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name,
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
             d.brand AS device_brand, d.model AS device_model, d.serial_number AS device_serial, d.device_type,
             u.first_name AS created_by_first, u.last_name AS created_by_last
      FROM invoices inv
      JOIN service_requests sr ON sr.id = inv.service_request_id
      JOIN customers c ON c.id = inv.customer_id
      JOIN devices d ON d.id = sr.device_id
      JOIN users u ON u.id = inv.created_by
      WHERE inv.id = ?
      LIMIT 1
    `;
    const headers = await query(headerSql, [invoiceId]);
    if (headers.length === 0) return null;
    const invoice = headers[0];

    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC', [invoiceId]);
    const payments = await query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC', [invoiceId]);

    invoice.items = items;
    invoice.payments = payments;
    return invoice;
  }

  /**
   * Search and filter invoices with pagination
   */
  static async searchInvoices({ search = '', paymentStatus = '', customerId = null, page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = '1 = 1';
    const params = [];

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause += ` AND (inv.invoice_number LIKE ? OR sr.ticket_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (paymentStatus) {
      whereClause += ' AND inv.payment_status = ?';
      params.push(paymentStatus);
    }

    if (customerId) {
      whereClause += ' AND inv.customer_id = ?';
      params.push(customerId);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM invoices inv
      JOIN service_requests sr ON sr.id = inv.service_request_id
      JOIN customers c ON c.id = inv.customer_id
      WHERE ${whereClause}
    `;
    const [countRow] = await query(countSql, params);
    const total = countRow ? countRow.total : 0;

    const dataSql = `
      SELECT inv.*, sr.ticket_number,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone
      FROM invoices inv
      JOIN service_requests sr ON sr.id = inv.service_request_id
      JOIN customers c ON c.id = inv.customer_id
      WHERE ${whereClause}
      ORDER BY inv.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      invoices: rows
    };
  }
}

module.exports = InvoiceModel;
