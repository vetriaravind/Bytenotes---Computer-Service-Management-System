/**
 * Customer Feedback Controller
 * Handles post-service ratings, customer reviews, and raised complaints (Module 10).
 */

const FeedbackModel = require('../models/feedbackModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class FeedbackController {
  static async submitFeedback(req, res, next) {
    try {
      const { serviceRequestId, rating, comments, isComplaint = false } = req.body;

      if (!serviceRequestId || !rating) {
        return errorResponse(res, 400, 'Service Request ID and Rating (1-5) are required.');
      }

      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) return errorResponse(res, 404, `Ticket with ID ${serviceRequestId} not found.`);

      if (req.user.role === 'CUSTOMER' && ticket.customer_id !== req.user.customer_profile_id) {
        return errorResponse(res, 403, 'You can only submit feedback for your own serviced devices.');
      }

      const existing = await FeedbackModel.findByTicket(serviceRequestId);
      if (existing) {
        return errorResponse(res, 409, 'Feedback has already been recorded for this service request.');
      }

      const feedbackId = await FeedbackModel.submitFeedback({
        serviceRequestId,
        customerId: ticket.customer_id,
        rating,
        comments,
        isComplaint
      });

      return successResponse(res, 201, 'Feedback submitted successfully. Thank you for helping us improve!', {
        feedbackId
      });
    } catch (error) {
      next(error);
    }
  }

  static async listFeedback(req, res, next) {
    try {
      const { complaintsOnly = 'false', page = 1, limit = 20 } = req.query;
      const result = await FeedbackModel.listAll({
        complaintsOnly: complaintsOnly === 'true',
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      return successResponse(res, 200, 'Feedback retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FeedbackController;
