/**
 * Estimate & Quotation Controller
 * Manages repair cost quotations, revision history & customer approval gates (Module 7).
 */

const EstimateModel = require('../models/estimateModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class EstimateController {
  /**
   * @route   POST /api/estimates
   * @desc    Generate a new or revised repair estimate (Scenario 5)
   * @access  Protected (ADMIN, TECHNICIAN)
   */
  static async createEstimate(req, res, next) {
    try {
      const { serviceRequestId, labourCharge = 0.00, items = [], notes = null } = req.body;

      if (!serviceRequestId) {
        return errorResponse(res, 400, 'Service Request ID is required.');
      }

      if (!items || items.length === 0) {
        return errorResponse(res, 400, 'At least one line item (spare part or labour) is required in the estimate.');
      }

      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) {
        return errorResponse(res, 404, `Service request with ID ${serviceRequestId} was not found.`);
      }

      if (['DELIVERED', 'CANCELLED'].includes(ticket.status)) {
        return errorResponse(res, 400, `Cannot create estimate for ticket in terminal status "${ticket.status}".`);
      }

      const result = await EstimateModel.createEstimate({
        serviceRequestId,
        labourCharge,
        items,
        createdBy: req.user.id,
        notes
      });

      const fullEstimate = await EstimateModel.findByIdWithItems(result.estimateId);

      return successResponse(res, 201, `Repair estimate v${result.versionNumber} generated successfully. Status moved to WAITING_FOR_CUSTOMER_APPROVAL.`, {
        estimate: fullEstimate
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/estimates/:id
   * @desc    Get detailed estimate with itemized parts & labour
   * @access  Protected
   */
  static async getEstimateById(req, res, next) {
    try {
      const { id } = req.params;
      const estimate = await EstimateModel.findByIdWithItems(id);

      if (!estimate) {
        return errorResponse(res, 404, `Estimate with ID ${id} was not found.`);
      }

      // Customer authorization check
      if (req.user.role === 'CUSTOMER' && estimate.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'Access denied. You do not have permission to view this quotation.');
      }

      return successResponse(res, 200, 'Repair estimate details retrieved successfully', {
        estimate
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/estimates/ticket/:serviceRequestId
   * @desc    Get all estimate revisions for a ticket (Scenario 5)
   * @access  Protected
   */
  static async getEstimatesByTicket(req, res, next) {
    try {
      const { serviceRequestId } = req.params;
      const ticket = await ServiceRequestModel.findById(serviceRequestId);

      if (!ticket) {
        return errorResponse(res, 404, `Service request with ID ${serviceRequestId} was not found.`);
      }

      if (req.user.role === 'CUSTOMER' && ticket.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'Access denied.');
      }

      const history = await EstimateModel.getHistoryByTicket(serviceRequestId);

      return successResponse(res, 200, 'Estimate history retrieved successfully', {
        service_request_id: serviceRequestId,
        total_revisions: history.length,
        estimates: history
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/estimates/:id/respond
   * @desc    Customer approves or rejects repair quotation (Scenarios 4 & 5)
   * @access  Protected (CUSTOMER, ADMIN)
   */
  static async respondToEstimate(req, res, next) {
    try {
      const { id } = req.params;
      const { action, customerNotes, rejectionReason } = req.body;

      if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
        return errorResponse(res, 400, 'Action is required and must be either "APPROVE" or "REJECT".');
      }

      const estimate = await EstimateModel.findByIdWithItems(id);
      if (!estimate) {
        return errorResponse(res, 404, `Estimate with ID ${id} was not found.`);
      }

      // Customer verification
      if (req.user.role === 'CUSTOMER' && estimate.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'You are not authorized to respond to an estimate that does not belong to you.');
      }

      await EstimateModel.respondToEstimate({
        estimateId: id,
        action: action.toUpperCase(),
        customerNotes,
        rejectionReason,
        userId: req.user.id
      });

      const updatedEstimate = await EstimateModel.findByIdWithItems(id);

      return successResponse(
        res,
        200,
        action.toUpperCase() === 'APPROVE'
          ? 'Estimate approved successfully! Repair work has been authorized and moved to IN_PROGRESS.'
          : 'Estimate rejected. Repair has been cancelled as requested (Scenario 4).',
        {
          estimate: updatedEstimate
        }
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EstimateController;
