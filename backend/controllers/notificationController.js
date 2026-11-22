/**
 * Notification Controller
 * Retrieves and updates user in-app notifications (Module 11).
 */

const NotificationModel = require('../models/notificationModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class NotificationController {
  static async getMyNotifications(req, res, next) {
    try {
      const notifications = await NotificationModel.getUserNotifications(req.user.id);
      const unreadCount = await NotificationModel.getUnreadCount(req.user.id);

      return successResponse(res, 200, 'Notifications retrieved successfully', {
        unreadCount,
        notifications
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      await NotificationModel.markAsRead(id, req.user.id);
      return successResponse(res, 200, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req, res, next) {
    try {
      await NotificationModel.markAllAsRead(req.user.id);
      return successResponse(res, 200, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificationController;
