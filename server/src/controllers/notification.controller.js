const notificationModel = require('../models/notification.model');

// Get notifications for the logged-in user (assigned_to)
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await notificationModel.getNotificationsForUser(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get one of the logged-in user's notifications by ID
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await notificationModel.getNotificationById(req.params.id, req.user.userId);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json(notification);
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Update notification (mark as read)
exports.updateNotification = async (req, res) => {
  try {
    const notification = await notificationModel.markAsRead(req.params.id, req.user.userId);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json(notification);
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const deleted = await notificationModel.deleteNotification(req.params.id, req.user.userId);
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
