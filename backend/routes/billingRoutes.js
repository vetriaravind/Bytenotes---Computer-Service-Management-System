/**
 * Billing & Payments Routes (Module 9)
 */

const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billingController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Invoices
router.post('/invoices', authorize('ADMIN', 'RECEPTIONIST'), BillingController.createInvoice);
router.get('/invoices', BillingController.getInvoices);
router.get('/invoices/:id', BillingController.getInvoiceById);

// Payments (Scenario 7)
router.post('/payments', authorize('ADMIN', 'RECEPTIONIST'), BillingController.recordPayment);

module.exports = router;
