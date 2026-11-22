/**
 * Repair Estimate & Quotation Routes (Module 7)
 */

const express = require('express');
const router = express.Router();
const EstimateController = require('../controllers/estimateController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Create new or revised estimate (ADMIN, TECHNICIAN, RECEPTIONIST)
router.post('/', authorize('ADMIN', 'TECHNICIAN', 'RECEPTIONIST'), EstimateController.createEstimate);

// View estimates
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), EstimateController.getEstimateById);
router.get('/ticket/:serviceRequestId', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), EstimateController.getEstimatesByTicket);

// Customer approval gate (APPROVE or REJECT quotation - Scenario 4 & 5)
router.post('/:id/respond', authorize('CUSTOMER', 'ADMIN'), EstimateController.respondToEstimate);

module.exports = router;
