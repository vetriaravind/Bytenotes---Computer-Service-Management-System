/**
 * Technician & Repair Workflow Routes (Module 5 & 6)
 */

const express = require('express');
const router = express.Router();
const TechnicianController = require('../controllers/technicianController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All technician routes require authentication
router.use(protect);

// Technician Roster & Capacity (ADMIN, RECEPTIONIST)
router.get('/', authorize('ADMIN', 'RECEPTIONIST'), TechnicianController.getTechnicians);
router.post('/', authorize('ADMIN'), TechnicianController.createTechnician);

// Job Assignment & Handover (ADMIN)
router.post('/assign', authorize('ADMIN'), TechnicianController.assignTicket);
router.get('/load-balancer/recommend', authorize('ADMIN', 'RECEPTIONIST'), TechnicianController.getLoadBalancerRecommendation);

// Technician Workbench & Assignment Acceptance (TECHNICIAN)
router.get('/my-workbench', authorize('TECHNICIAN'), TechnicianController.getMyWorkbench);
router.post('/respond-assignment', authorize('TECHNICIAN'), TechnicianController.respondAssignment);

// Lifecycle State Transition (ADMIN, TECHNICIAN)
router.patch('/update-status', authorize('ADMIN', 'TECHNICIAN'), TechnicianController.updateStatus);

// Multi-Technician Assignment History (Scenario 14)
router.get('/assignment-history/:serviceRequestId', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN'), TechnicianController.getAssignmentHistory);

// Specific Technician by ID (must come after static routes like /my-workbench)
router.get('/:id', authorize('ADMIN'), TechnicianController.getTechnicianById);
router.put('/:id', authorize('ADMIN'), TechnicianController.updateTechnician);
router.delete('/:id', authorize('ADMIN'), TechnicianController.deleteTechnician);

module.exports = router;
