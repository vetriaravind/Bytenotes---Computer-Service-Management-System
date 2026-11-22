/**
 * Technician Controller
 * Manages technician workload, assignments, workbench queue & repair status updates (Module 5 & 6).
 */

const TechnicianModel = require('../models/technicianModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const StatusHistoryModel = require('../models/statusHistoryModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class TechnicianController {
  /**
   * @route   GET /api/technicians
   * @desc    List all technicians with real-time active workload and availability
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async getTechnicians(req, res, next) {
    try {
      const { status = '', specialization = '' } = req.query;
      const technicians = await TechnicianModel.listWithWorkload({ status, specialization });

      return successResponse(res, 200, 'Technicians retrieved successfully', {
        total: technicians.length,
        technicians
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/technicians/:id
   * @desc    Get technician profile, performance metrics & workload
   * @access  Protected (ADMIN)
   */
  static async getTechnicianById(req, res, next) {
    try {
      const { id } = req.params;
      const technician = await TechnicianModel.findById(id);

      if (!technician) {
        return errorResponse(res, 404, `Technician with ID ${id} was not found.`);
      }

      const metrics = await TechnicianModel.getMetrics(id);

      return successResponse(res, 200, 'Technician details retrieved successfully', {
        technician,
        metrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/technicians/assign
   * @desc    Assign or Reassign a service ticket to a technician (Scenario 2 & 14)
   * @access  Protected (ADMIN)
   */
  /**
   * @route   POST /api/technicians/assign
   * @desc    Assign service ticket to technician (supports explicit ID or 'auto' for Smart Load Balancer)
   * @access  Protected (ADMIN)
   */
  static async assignTicket(req, res, next) {
    try {
      let { serviceRequestId, technicianId, notes } = req.body;

      if (!serviceRequestId) {
        return errorResponse(res, 400, 'Service Request ID is required.');
      }

      // If 'auto' or omitted, use Smart Load Balancer algorithm
      let isAutoBalanced = false;
      let targetTech = null;

      if (!technicianId || technicianId === 'auto') {
        targetTech = await TechnicianModel.getLeastLoadedTechnician();
        if (!targetTech) {
          return errorResponse(
            res,
            409,
            'Load Balancer: All available technicians are currently at maximum active ticket capacity. Please adjust limits or add staff.'
          );
        }
        technicianId = targetTech.id;
        isAutoBalanced = true;
      }

      // Verify ticket exists
      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) {
        return errorResponse(res, 404, `Service request with ID ${serviceRequestId} was not found.`);
      }

      if (['DELIVERED', 'CANCELLED'].includes(ticket.status)) {
        return errorResponse(res, 400, `Cannot assign technician. Ticket is already in terminal state: ${ticket.status}.`);
      }

      const assignmentId = await TechnicianModel.assignTicket({
        serviceRequestId,
        technicianId,
        assignedBy: req.user.id,
        notes: notes || (isAutoBalanced ? 'Auto-assigned by Workload Load Balancer.' : null)
      });

      const assignedTech = targetTech || (await TechnicianModel.findById(technicianId));

      return successResponse(
        res,
        201,
        `Ticket ${ticket.ticket_number} successfully assigned to ${assignedTech.first_name} ${assignedTech.last_name} (${isAutoBalanced ? 'Load Balanced' : 'Direct'}).`,
        {
          assignmentId,
          serviceRequestId,
          technicianId,
          technicianName: `${assignedTech.first_name} ${assignedTech.last_name}`,
          isAutoBalanced
        }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/technicians/load-balancer/recommend
   * @desc    Get recommended technician according to Workload Load Balancer
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async getLoadBalancerRecommendation(req, res, next) {
    try {
      const bestTech = await TechnicianModel.getLeastLoadedTechnician();
      if (!bestTech) {
        return successResponse(res, 200, 'No available technician under capacity currently', {
          available: false,
          recommended: null
        });
      }
      return successResponse(res, 200, 'Load Balancer recommended technician retrieved', {
        available: true,
        recommended: bestTech
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/technicians/respond-assignment
   * @desc    Technician accepts or rejects an assigned service ticket
   * @access  Protected (TECHNICIAN)
   */
  static async respondAssignment(req, res, next) {
    try {
      const { assignmentId, responseStatus, technicianNotes, rejectionReason } = req.body;

      if (!assignmentId || !responseStatus) {
        return errorResponse(res, 400, 'Assignment ID and responseStatus (ACCEPTED or REJECTED) are required.');
      }

      if (!['ACCEPTED', 'REJECTED'].includes(responseStatus.toUpperCase())) {
        return errorResponse(res, 400, 'responseStatus must be either "ACCEPTED" or "REJECTED".');
      }

      // Verify technician profile
      const techProfile = await TechnicianModel.findByUserId(req.user.id);
      if (!techProfile) {
        return errorResponse(res, 403, 'No technician profile associated with this user account.');
      }

      await TechnicianModel.respondToAssignment({
        assignmentId,
        technicianId: techProfile.id,
        responseStatus: responseStatus.toUpperCase(),
        technicianNotes,
        rejectionReason,
        userId: req.user.id
      });

      return successResponse(
        res,
        200,
        `Assignment successfully marked as ${responseStatus.toUpperCase()}.`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/technicians/my-workbench
   * @desc    Get currently assigned workbench jobs for logged-in technician
   * @access  Protected (TECHNICIAN)
   */
  static async getMyWorkbench(req, res, next) {
    try {
      const techProfile = await TechnicianModel.findByUserId(req.user.id);
      if (!techProfile) {
        return errorResponse(res, 403, 'No technician profile linked to this user account.');
      }

      const { status = '', page = 1, limit = 10 } = req.query;

      const workbench = await TechnicianModel.getTechnicianWorkbench(techProfile.id, {
        status,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return successResponse(res, 200, 'Technician workbench jobs retrieved successfully', {
        technician: {
          id: techProfile.id,
          employeeCode: techProfile.employee_code,
          specialization: techProfile.specialization
        },
        ...workbench
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/technicians/update-status
   * @desc    Transition service repair status with strict state-machine validation (Module 6)
   * @access  Protected (ADMIN, TECHNICIAN)
   */
  static async updateStatus(req, res, next) {
    try {
      const {
        serviceRequestId,
        targetStatus,
        remarks,
        cancellationReason,
        unrepairableReason
      } = req.body;

      if (!serviceRequestId || !targetStatus) {
        return errorResponse(res, 400, 'Service Request ID and targetStatus are required.');
      }

      const result = await StatusHistoryModel.transitionStatus({
        serviceRequestId,
        targetStatus: targetStatus.toUpperCase(),
        changedBy: req.user.id,
        remarks,
        cancellationReason,
        unrepairableReason
      });

      return successResponse(
        res,
        200,
        `Service status successfully updated from ${result.previousStatus} to ${result.newStatus}.`,
        result
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/technicians
   * @desc    Create a new technician user & profile (Module 6)
   * @access  Protected (ADMIN)
   */
  static async createTechnician(req, res, next) {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        employeeCode,
        specialization,
        experienceYears,
        maxActiveTickets
      } = req.body;

      if (!username || !email || !firstName || !lastName || !phone || !employeeCode) {
        return errorResponse(res, 400, 'Username, email, first name, last name, phone, and employee code are required.');
      }

      const techId = await TechnicianModel.createTechnician({
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        employeeCode,
        specialization,
        experienceYears,
        maxActiveTickets
      });

      const newTech = await TechnicianModel.findById(techId);

      return successResponse(res, 201, 'Technician created successfully', {
        technician: newTech
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/technicians/:id
   * @desc    Update technician details and workload parameters (Module 6)
   * @access  Protected (ADMIN)
   */
  static async updateTechnician(req, res, next) {
    try {
      const { id } = req.params;
      await TechnicianModel.updateTechnician(id, req.body);
      const updated = await TechnicianModel.findById(id);

      return successResponse(res, 200, 'Technician updated successfully', {
        technician: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/technicians/:id
   * @desc    Deactivate technician account (Module 6)
   * @access  Protected (ADMIN)
   */
  static async deleteTechnician(req, res, next) {
    try {
      const { id } = req.params;
      await TechnicianModel.deleteTechnician(id);

      return successResponse(res, 200, 'Technician deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/technicians/assignment-history/:serviceRequestId
   * @desc    Get full technician handover/reassignment history for a ticket (Scenario 14)
   * @access  Protected
   */
  static async getAssignmentHistory(req, res, next) {
    try {
      const { serviceRequestId } = req.params;
      const history = await TechnicianModel.getAssignmentHistory(serviceRequestId);

      return successResponse(res, 200, 'Ticket assignment history retrieved successfully', {
        service_request_id: serviceRequestId,
        total_assignments: history.length,
        history
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TechnicianController;
