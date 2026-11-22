/**
 * Billing & Payment Processing Controller
 * Manages invoice generation, partial payments, GST calculations & statements (Module 9).
 */

const InvoiceModel = require('../models/invoiceModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const InventoryModel = require('../models/inventoryModel');
const EstimateModel = require('../models/estimateModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class BillingController {
  /**
   * @route   POST /api/billing/invoices
   * @desc    Generate an invoice for a service request
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async createInvoice(req, res, next) {
    try {
      const { serviceRequestId, discountAmount = 0.00, taxRate = 18.00, customItems = [] } = req.body;

      if (!serviceRequestId) return errorResponse(res, 400, 'Service Request ID is required.');

      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) return errorResponse(res, 404, `Ticket with ID ${serviceRequestId} not found.`);

      let items = [];

      // Auto-populate items from installed spare parts & approved estimates if not custom provided
      if (customItems.length > 0) {
        items = customItems;
      } else {
        // 1. Pull installed spare parts from repair_parts
        const parts = await InventoryModel.getPartsUsedOnTicket(serviceRequestId);
        for (const p of parts) {
          items.push({
            description: `${p.part_name} (${p.part_number})`,
            itemType: 'PART',
            quantity: p.quantity,
            unitPrice: p.unit_price
          });
        }

        // 2. Pull labour charge from latest approved estimate
        const estimates = await EstimateModel.getHistoryByTicket(serviceRequestId);
        const approvedEstimate = estimates.find((e) => e.status === 'APPROVED');
        if (approvedEstimate && parseFloat(approvedEstimate.labour_charge) > 0) {
          items.push({
            description: 'Technical Hardware & Diagnostic Labour Charges',
            itemType: 'LABOUR',
            quantity: 1,
            unitPrice: parseFloat(approvedEstimate.labour_charge)
          });
        }

        // Fallback default inspection labour if no items found
        if (items.length === 0) {
          items.push({
            description: 'Standard Computer Diagnostic & Repair Labour',
            itemType: 'LABOUR',
            quantity: 1,
            unitPrice: parseFloat(ticket.estimated_cost) || 350.00
          });
        }
      }

      const invoice = await InvoiceModel.createInvoice({
        serviceRequestId,
        customerId: ticket.customer_id,
        discountAmount,
        taxRate,
        items,
        createdBy: req.user.id
      });

      return successResponse(res, 201, `Invoice ${invoice.invoice_number} created successfully`, {
        invoice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/billing/invoices
   * @desc    List and multi-filter invoices with pagination
   * @access  Protected
   */
  static async getInvoices(req, res, next) {
    try {
      let { search = '', paymentStatus = '', customerId = null, page = 1, limit = 10 } = req.query;

      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
      }

      const result = await InvoiceModel.searchInvoices({
        search,
        paymentStatus,
        customerId,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return successResponse(res, 200, 'Invoices retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/billing/invoices/:id
   * @desc    Get detailed invoice with line items & payment transactions
   * @access  Protected
   */
  static async getInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceModel.findByIdWithDetails(id);

      if (!invoice) return errorResponse(res, 404, `Invoice with ID ${id} was not found.`);

      if (req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'Access denied.');
      }

      return successResponse(res, 200, 'Invoice retrieved successfully', { invoice });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/billing/payments
   * @desc    Record customer payment (advance, partial, final settlement - Scenario 7)
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async recordPayment(req, res, next) {
    try {
      const { invoiceId, amount, paymentMethod, transactionId, paymentType = 'FINAL_SETTLEMENT', notes } = req.body;

      if (!invoiceId || !amount || !paymentMethod) {
        return errorResponse(res, 400, 'Invoice ID, payment amount, and paymentMethod (CASH, UPI, CARD, BANK_TRANSFER) are required.');
      }

      const validMethods = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'];
      if (!validMethods.includes(paymentMethod.toUpperCase())) {
        return errorResponse(res, 400, `Invalid payment method. Allowed: ${validMethods.join(', ')}`);
      }

      const result = await InvoiceModel.addPayment({
        invoiceId,
        amount,
        paymentMethod: paymentMethod.toUpperCase(),
        transactionId,
        paymentType,
        notes,
        receivedBy: req.user.id
      });

      return successResponse(
        res,
        201,
        `Payment of ₹${parseFloat(amount).toFixed(2)} recorded successfully via ${paymentMethod.toUpperCase()} (Ref: ${result.paymentReference}). Remaining balance: ₹${result.remainingBalance.toFixed(2)}.`,
        result
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BillingController;
