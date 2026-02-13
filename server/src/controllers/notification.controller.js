// Get notifications for the logged-in user (assigned_to)
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await notificationModel.getNotificationsForUser(userId);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const notificationModel = require('../models/notification.model');


// Create a new notification
exports.createNotification = async (req, res) => {
  try {
    const notification = await notificationModel.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await notificationModel.getAllNotifications();
    res.status(200).json(notifications);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get notification by ID
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await notificationModel.getNotificationById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Update notification (mark as read)
exports.updateNotification = async (req, res) => {
  try {
    const notification = await notificationModel.markAsRead(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const deleted = await notificationModel.deleteNotification(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
