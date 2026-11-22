/**
 * Technical Diagnosis Routes (Module 7)
 */

const express = require('express');
const router = express.Router();
const DiagnosisController = require('../controllers/diagnosisController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', authorize('ADMIN', 'TECHNICIAN'), DiagnosisController.saveDiagnosis);
router.get('/:serviceRequestId', authorize('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER'), DiagnosisController.getDiagnosis);

module.exports = router;
