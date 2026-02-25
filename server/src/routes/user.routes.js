const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', userController.getMyProfile);

// Update current user profile
router.put('/me', userController.updateMyProfile);

// Minimal list of assignable users (any authenticated user)
router.get('/assignable', userController.getAssignableUsers);

// Super admin and management routes
router.get('/', authorize('admin', 'management'), userController.getAllUsers);
router.get('/department/:id', authorize('admin', 'management', 'manager'), userController.getUsersByDepartment);
router.get('/:id', userController.getUserById);
router.post('/', authorize('admin'), userController.createUser);
router.put('/:id', authorize('admin'), userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
