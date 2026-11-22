/**
 * Diagnosis Controller
 * Manages technical diagnostic findings, root cause analysis & labour estimations (Module 7).
 */

const DiagnosisModel = require('../models/diagnosisModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const TechnicianModel = require('../models/technicianModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class DiagnosisController {
  /**
   * @route   POST /api/diagnosis
   * @desc    Save or update technical diagnosis findings
   * @access  Protected (ADMIN, TECHNICIAN)
   */
  static async saveDiagnosis(req, res, next) {
    try {
      const {
        serviceRequestId,
        findings,
        rootCause,
        recommendedAction,
        estimatedHours = 1.0,
        estimatedLabourCost = 0.00
      } = req.body;

      if (!serviceRequestId || !findings || !rootCause || !recommendedAction) {
        return errorResponse(res, 400, 'Service Request ID, findings, root cause, and recommended action are required.');
      }

      // Verify service request exists
      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) {
        return errorResponse(res, 404, `Service request with ID ${serviceRequestId} was not found.`);
      }

      // Identify technician ID
      let technicianId = null;
      if (req.user.role === 'TECHNICIAN') {
        const techProfile = await TechnicianModel.findByUserId(req.user.id);
        if (!techProfile) {
          return errorResponse(res, 403, 'No technician profile linked to this user account.');
        }
        technicianId = techProfile.id;
      } else if (req.body.technicianId) {
        technicianId = req.body.technicianId;
      } else if (ticket.current_technician_id) {
        technicianId = ticket.current_technician_id;
      } else {
        return errorResponse(res, 400, 'Technician ID must be specified for diagnosis report.');
      }

      const diagnosisId = await DiagnosisModel.saveDiagnosis({
        serviceRequestId,
        technicianId,
        findings,
        rootCause,
        recommendedAction,
        estimatedHours,
        estimatedLabourCost
      });

      const report = await DiagnosisModel.findByServiceRequestId(serviceRequestId);

      return successResponse(res, 200, 'Technical diagnosis report saved successfully', {
        diagnosisId,
        report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/diagnosis/:serviceRequestId
   * @desc    Get diagnosis report for a service ticket
   * @access  Protected
   */
  static async getDiagnosis(req, res, next) {
    try {
      const { serviceRequestId } = req.params;
      const report = await DiagnosisModel.findByServiceRequestId(serviceRequestId);

      if (!report) {
        return errorResponse(res, 404, `No diagnosis report found for Service Request ID ${serviceRequestId}.`);
      }

      return successResponse(res, 200, 'Diagnosis report retrieved successfully', {
        report
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DiagnosisController;
