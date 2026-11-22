/**
 * Analytics Controller
 * Provides executive dashboard statistics, revenue charts & technician rankings (Module 13).
 */

const AnalyticsModel = require('../models/analyticsModel');
const { successResponse } = require('../utils/apiResponse');

class AnalyticsController {
  static async getDashboardMetrics(req, res, next) {
    try {
      const stats = await AnalyticsModel.getOverviewStats();
      const revenueChart = await AnalyticsModel.getMonthlyRevenue(6);
      const technicianRanking = await AnalyticsModel.getTechnicianPerformance();
      const problemDistribution = await AnalyticsModel.getCommonProblems();
      const recentRequests = await AnalyticsModel.getRecentRequests(6);
      const recentPayments = await AnalyticsModel.getRecentPayments(6);

      return successResponse(res, 200, 'Dashboard analytics retrieved successfully', {
        stats: stats.overview,
        financials: stats.financials,
        revenueChart,
        technicianRanking,
        problemDistribution,
        recentRequests,
        recentPayments
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnalyticsController;
