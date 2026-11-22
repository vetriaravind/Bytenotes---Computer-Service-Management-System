/**
 * Customer Management Routes (Module 2)
 */

const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All customer routes require authentication
router.use(protect);

// Customer CRUD & Search
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), CustomerController.createCustomer);
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN'), CustomerController.getCustomers);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), CustomerController.getCustomerById);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), CustomerController.updateCustomer);
router.delete('/:id', authorize('ADMIN'), CustomerController.deleteCustomer);

// Sub-resources: devices & service history
router.get('/:id/devices', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), CustomerController.getCustomerDevices);
router.get('/:id/history', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), CustomerController.getCustomerHistory);

module.exports = router;
