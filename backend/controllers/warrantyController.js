/**
 * Warranty Controller
 * Manages repair warranty creation and eligibility checks (Module 12 & Scenario 10).
 */

const WarrantyModel = require('../models/warrantyModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class WarrantyController {
  static async getWarranties(req, res, next) {
    try {
      let { customerId = null, page = 1, limit = 20 } = req.query;
      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
      }
      const result = await WarrantyModel.listWarranties({ customerId, page, limit });
      return successResponse(res, 200, 'Warranties retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async createWarranty(req, res, next) {
    try {
      const { serviceRequestId, warrantyPeriodDays = 90, terms } = req.body;
      if (!serviceRequestId) return errorResponse(res, 400, 'Service Request ID is required.');

      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) return errorResponse(res, 404, `Ticket with ID ${serviceRequestId} not found.`);

      const warranty = await WarrantyModel.createWarranty({
        serviceRequestId,
        deviceId: ticket.device_id,
        warrantyPeriodDays,
        terms
      });

      return successResponse(res, 201, `Warranty certificate ${warranty.warrantyCode} created successfully (Valid for ${warrantyPeriodDays} days).`, {
        warranty
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check warranty eligibility for a returning device (Scenario 10)
   */
  static async checkWarranty(req, res, next) {
    try {
      const { query: searchParam } = req.params;
      if (!searchParam) return errorResponse(res, 400, 'Serial number, Ticket number, or Warranty code is required.');

      const warranty = await WarrantyModel.checkEligibility(searchParam);

      if (!warranty) {
        return successResponse(res, 200, 'No active warranty certificate found for this identifier.', {
          hasWarranty: false,
          isEligible: false
        });
      }

      return successResponse(res, 200, 'Warranty verification completed', {
        hasWarranty: true,
        isEligible: Boolean(warranty.is_valid),
        daysRemaining: Math.max(0, warranty.days_remaining),
        warranty
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = WarrantyController;
