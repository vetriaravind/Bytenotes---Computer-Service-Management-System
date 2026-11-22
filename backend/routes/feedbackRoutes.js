/**
 * Feedback & Complaints Routes (Module 10)
 */

const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', authorize('CUSTOMER', 'ADMIN'), FeedbackController.submitFeedback);
router.get('/', authorize('ADMIN'), FeedbackController.listFeedback);

module.exports = router;
