const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', userController.getMyProfile);

// Super admin and management routes
router.get('/', authorize('super_admin', 'management'), userController.getAllUsers);
router.get('/:id', authorize('super_admin', 'management'), userController.getUserById);
router.post('/', authorize('super_admin'), userController.createUser);
router.put('/:id', authorize('super_admin'), userController.updateUser);
router.delete('/:id', authorize('super_admin'), userController.deleteUser);

module.exports = router;
