/**
 * Service Request Controller
 * Manages ticket creation, lifecycle tracking, multi-facet filtering & printable receipts (Module 4).
 */

const ServiceRequestModel = require('../models/serviceRequestModel');
const CustomerModel = require('../models/customerModel');
const DeviceModel = require('../models/deviceModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class ServiceRequestController {
  /**
   * @route   POST /api/service-requests
   * @desc    Create a new service repair ticket
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async createRequest(req, res, next) {
    try {
      let {
        customerId,
        deviceId,
        reportedIssue,
        priority = 'MEDIUM',
        estimatedCost = 0.00,
        expectedDeliveryDate = null,
        intakeRemarks = null
      } = req.body;

      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
      }

      if (!customerId || !deviceId || !reportedIssue) {
        return errorResponse(res, 400, 'Customer ID, Device ID, and Reported Issue description are required.');
      }

      // 1. Verify customer exists
      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${customerId} does not exist.`);
      }

      // 2. Verify device exists and belongs to this customer
      const device = await DeviceModel.findById(deviceId);
      if (!device) {
        return errorResponse(res, 404, `Device with ID ${deviceId} does not exist.`);
      }

      if (device.customer_id !== parseInt(customerId, 10)) {
        return errorResponse(res, 400, `Device ${device.brand} ${device.model} does not belong to Customer ID ${customerId}.`);
      }

      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const chosenPriority = validPriorities.includes(priority.toUpperCase()) ? priority.toUpperCase() : 'MEDIUM';

      // 3. Atomically create service request and initial status_history entry
      const result = await ServiceRequestModel.createServiceRequest({
        customerId,
        deviceId,
        reportedIssue,
        priority: chosenPriority,
        estimatedCost: parseFloat(estimatedCost) || 0.00,
        expectedDeliveryDate,
        intakeRemarks,
        createdBy: req.user.id
      });

      const fullRequest = await ServiceRequestModel.findById(result.id);

      return successResponse(res, 201, `Service ticket ${result.ticketNumber} created successfully`, {
        ticket: fullRequest
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/service-requests
   * @desc    List and multi-filter service requests with pagination
   * @access  Protected
   */
  static async getRequests(req, res, next) {
    try {
      let {
        search = '',
        status = '',
        priority = '',
        customerId = null,
        technicianId = null,
        startDate = null,
        endDate = null,
        page = 1,
        limit = 10
      } = req.query;

      // Role isolation: Customers can only query their own service requests
      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
        if (!customerId) {
          return successResponse(res, 200, 'No service requests found for this customer profile.', {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
            requests: []
          });
        }
      }

      const result = await ServiceRequestModel.searchAndFilter({
        search,
        status,
        priority,
        customerId,
        technicianId,
        startDate,
        endDate,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return successResponse(res, 200, 'Service requests retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/service-requests/:id
   * @desc    Get detailed ticket view with device specs, owner info, and status history
   * @access  Protected
   */
  static async getRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const request = await ServiceRequestModel.findById(id);

      if (!request) {
        return errorResponse(res, 404, `Service request with ID ${id} was not found.`);
      }

      // Customer authorization check
      if (req.user.role === 'CUSTOMER' && request.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'Access denied. You do not have permission to view this ticket.');
      }

      // Fetch lifecycle audit timeline
      const statusHistory = await ServiceRequestModel.getStatusHistory(id);

      return successResponse(res, 200, 'Service ticket details retrieved successfully', {
        request,
        statusHistory
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/service-requests/track/:ticketNumber
   * @desc    Track ticket progress by ticket number (e.g. BN-202611-0001)
   * @access  Public / Customer Portal
   */
  static async trackTicket(req, res, next) {
    try {
      const { ticketNumber } = req.params;
      const request = await ServiceRequestModel.findByTicketNumber(ticketNumber);

      if (!request) {
        return errorResponse(res, 404, `No service ticket found matching "${ticketNumber}". Please check the number.`);
      }

      const statusHistory = await ServiceRequestModel.getStatusHistory(request.id);

      return successResponse(res, 200, 'Ticket tracking information retrieved', {
        ticket: {
          ticketNumber: request.ticket_number,
          status: request.status,
          priority: request.priority,
          reportedIssue: request.reported_issue,
          expectedDeliveryDate: request.expected_delivery_date,
          intakeDate: request.created_at,
          device: {
            brand: request.brand,
            model: request.model,
            type: request.device_type
          },
          technician: request.tech_first_name ? `${request.tech_first_name} ${request.tech_last_name}` : 'Pending Assignment'
        },
        timeline: statusHistory
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/service-requests/:id
   * @desc    Update ticket metadata (priority, expected delivery date, issue notes)
   * @access  Protected (ADMIN, RECEPTIONIST, TECHNICIAN)
   */
  static async updateRequest(req, res, next) {
    try {
      const { id } = req.params;
      const request = await ServiceRequestModel.findById(id);

      if (!request) {
        return errorResponse(res, 404, `Service request with ID ${id} was not found.`);
      }

      const { priority, estimatedCost, expectedDeliveryDate, reportedIssue } = req.body;

      await ServiceRequestModel.updateServiceRequest(id, {
        priority: priority || request.priority,
        estimatedCost: estimatedCost !== undefined ? parseFloat(estimatedCost) : request.estimated_cost,
        expectedDeliveryDate: expectedDeliveryDate !== undefined ? expectedDeliveryDate : request.expected_delivery_date,
        reportedIssue: reportedIssue || request.reported_issue
      });

      const updated = await ServiceRequestModel.findById(id);

      return successResponse(res, 200, 'Service ticket updated successfully', {
        ticket: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/service-requests/:id/receipt
   * @desc    Generate printable service intake receipt data
   * @access  Protected
   */
  static async getReceipt(req, res, next) {
    try {
      const { id } = req.params;
      const receiptData = await ServiceRequestModel.getReceiptData(id);

      if (!receiptData) {
        return errorResponse(res, 404, `Service request with ID ${id} was not found.`);
      }

      return successResponse(res, 200, 'Intake receipt data generated successfully', {
        receipt: receiptData
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ServiceRequestController;
