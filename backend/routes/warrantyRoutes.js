/**
 * Warranty Routes (Module 12)
 */

const express = require('express');
const router = express.Router();
const WarrantyController = require('../controllers/warrantyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), WarrantyController.getWarranties);
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), WarrantyController.createWarranty);
router.get('/check/:query', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), WarrantyController.checkWarranty);

module.exports = router;
