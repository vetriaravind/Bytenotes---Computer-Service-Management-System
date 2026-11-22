/**
 * Service Request Management Routes (Module 4)
 */

const express = require('express');
const router = express.Router();
const ServiceRequestController = require('../controllers/serviceRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Public tracking endpoint (accessible to customers via ticket number e.g. BN-202611-0001)
router.get('/track/:ticketNumber', ServiceRequestController.trackTicket);

// All other endpoints require authentication
router.use(protect);

// Service Request CRUD & Filtering
router.post('/', authorize('ADMIN', 'RECEPTIONIST', 'CUSTOMER'), ServiceRequestController.createRequest);
router.get('/', ServiceRequestController.getRequests);
router.get('/:id', ServiceRequestController.getRequestById);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN'), ServiceRequestController.updateRequest);

// Printable Intake Receipt
router.get('/:id/receipt', authorize('ADMIN', 'RECEPTIONIST', 'CUSTOMER'), ServiceRequestController.getReceipt);

module.exports = router;
