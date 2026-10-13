const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Notifications are created server-side only (leave, ticket, user and role flows),
// so there is no public create endpoint. Every route is scoped to the logged-in user.
router.use(authenticate);

// Get notifications for the logged-in user (assigned_to)
router.get('/my', notificationController.getMyNotifications);
// Get one of the logged-in user's notifications by ID
router.get('/:id', notificationController.getNotificationById);
// Mark one of the logged-in user's notifications as read
router.put('/:id', notificationController.updateNotification);
// Delete one of the logged-in user's notifications
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
