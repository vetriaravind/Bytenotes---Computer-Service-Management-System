/**
 * Inventory & Spare Parts Routes (Module 8)
 */

const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Spare parts catalog
router.get('/', InventoryController.getParts);
router.post('/', authorize('ADMIN'), InventoryController.createPart);
router.get('/:id', InventoryController.getPartById);
router.post('/:id/restock', authorize('ADMIN'), InventoryController.restockPart);
router.post('/adjust', authorize('ADMIN'), InventoryController.recordAdjustment);

// Repair parts consumption (Scenario 8)
router.post('/consume', authorize('ADMIN', 'TECHNICIAN'), InventoryController.consumePart);
router.get('/ticket/:serviceRequestId', InventoryController.getTicketParts);

// Suppliers
router.get('/meta/suppliers', authorize('ADMIN', 'RECEPTIONIST'), InventoryController.getSuppliers);
router.post('/meta/suppliers', authorize('ADMIN'), InventoryController.createSupplier);

module.exports = router;
