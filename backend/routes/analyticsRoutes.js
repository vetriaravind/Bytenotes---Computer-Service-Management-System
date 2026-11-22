/**
 * Analytics Routes (Module 13)
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/dashboard', authorize('ADMIN'), AnalyticsController.getDashboardMetrics);

module.exports = router;
