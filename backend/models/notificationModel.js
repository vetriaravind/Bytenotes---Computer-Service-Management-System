/**
 * Notification Data Access Model
 * Manages user in-app notifications and unread badges (Module 11).
 */

const { query } = require('../config/db');

class NotificationModel {
  static async getUserNotifications(userId, { limit = 20 } = {}) {
    const sql = `
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await query(sql, [userId, parseInt(limit, 10)]);
  }

  static async getUnreadCount(userId) {
    const [row] = await query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    return row ? row.unread_count : 0;
  }

  static async markAsRead(notificationId, userId) {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [notificationId, userId]);
  }

  static async markAllAsRead(userId) {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
  }
}

module.exports = NotificationModel;
