const express = require('express');
const router = express.Router();
const userRoleController = require('../controllers/userRole.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// All user role routes require authentication
router.use(authenticate);

// Get all user roles
router.get('/', authorize('admin', 'management'), userRoleController.getAllUserRoles);

// Get user role by ID
router.get('/:id', authorize('admin', 'management'), userRoleController.getUserRoleById);

// Create user role
router.post('/', authorize('admin'), userRoleController.createUserRole);

// Update user role
router.put('/:id', authorize('admin'), userRoleController.updateUserRole);

// Delete user role
router.delete('/:id', authorize('admin'), userRoleController.deleteUserRole);

// Get user roles by user ID
router.get('/user/:userId', authorize('admin', 'management'), userRoleController.getUserRolesByUserId);

module.exports = router;
