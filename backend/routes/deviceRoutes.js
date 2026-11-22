/**
 * Device Management Routes (Module 3)
 */

const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/deviceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../config/multer');

// All device routes require authentication
router.use(protect);

// Device CRUD
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DeviceController.getDevices);
router.post('/', authorize('ADMIN', 'RECEPTIONIST', 'CUSTOMER'), DeviceController.createDevice);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DeviceController.getDeviceById);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DeviceController.updateDevice);
router.get('/customer/:customerId', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DeviceController.getDevicesByCustomer);

// Historical repair timeline & intake photo attachments (Scenario 1 & 11)
router.get('/:id/history', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DeviceController.getDeviceHistory);
router.post('/:id/attachments', authorize('ADMIN', 'RECEPTIONIST'), upload.array('photos', 5), DeviceController.uploadIntakePhotos);

module.exports = router;
