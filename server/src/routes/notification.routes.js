
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Get notifications for the logged-in user (assigned_to)
router.get('/my', authenticate, notificationController.getMyNotifications);

// Create notification
router.post('/', notificationController.createNotification);
// Get all notifications
router.get('/', notificationController.getAllNotifications);
// Get notification by ID
router.get('/:id', notificationController.getNotificationById);
// Update notification
router.put('/:id', notificationController.updateNotification);
// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
