/**
 * Event-Driven In-App Notification Service (Module 11)
 * Creates in-app alerts for customers, technicians, and administrators.
 */

const { query } = require('../config/db');

class NotificationService {
  /**
   * Create an in-app notification for a specific user
   */
  static async notify({ userId, title, message, type = 'INFO', referenceModule = null, referenceId = null }) {
    try {
      const sql = `
        INSERT INTO notifications (
          user_id, title, message, type, reference_module, reference_id, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, FALSE)
      `;
      const result = await query(sql, [
        userId,
        title.trim(),
        message.trim(),
        type,
        referenceModule,
        referenceId
      ]);
      return result.insertId;
    } catch (error) {
      console.error('Error dispatching notification:', error);
      return null;
    }
  }

  /**
   * Notify all system administrators (e.g. low stock alerts)
   */
  static async notifyAdmins({ title, message, type = 'ALERT', referenceModule = null, referenceId = null }) {
    try {
      const admins = await query("SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE");
      for (const admin of admins) {
        await this.notify({
          userId: admin.id,
          title,
          message,
          type,
          referenceModule,
          referenceId
        });
      }
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }
}

module.exports = NotificationService;
