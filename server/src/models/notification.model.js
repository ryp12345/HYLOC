const pool = require('../config/db');

// Get all notifications
exports.getAllNotifications = async () => {
  try {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllNotifications:', error);
    throw error;
  }
};

// Get notification by ID
exports.getNotificationById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getNotificationById:', error);
    throw error;
  }
};

// Get notifications for a user (assigned_to)
exports.getNotificationsForUser = async (userId) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE assigned_to = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
  } catch (error) {
    console.error('Database error in getNotificationsForUser:', error);
    throw error;
  }
};

// Create notification
exports.createNotification = async ({ created_by, assigned_to, message, type = null, is_read = false }) => {
  try {
    const result = await pool.query(
      'INSERT INTO notifications (created_by, assigned_to, message, type, is_read, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [created_by, assigned_to, message, type, is_read]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createNotification:', error);
    throw error;
  }
};

// Mark notification as read
exports.markAsRead = async (id) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in markAsRead:', error);
    throw error;
  }
};

// Delete notification
exports.deleteNotification = async (id) => {
  try {
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteNotification:', error);
    throw error;
  }
};
