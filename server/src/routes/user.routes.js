const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const uploadUser = require('../middlewares/uploadUser.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', userController.getMyProfile);

// Update current user profile
router.put('/me', uploadUser.safeSingle('staffPhoto'), uploadUser.validateContent, userController.updateMyProfile);

// Minimal list of assignable users (any authenticated user)
router.get('/assignable', userController.getAssignableUsers);

// Super admin, management and HR routes
router.get('/', authorize('admin', 'management', 'HR'), userController.getAllUsers);
router.get('/department/:id', authorize('admin', 'super admin', 'management', 'HR', 'hod'), userController.getUsersByDepartment);
router.get('/:id', userController.getUserById);
router.post('/', authorize('admin', 'management'), uploadUser.safeSingle('staffPhoto'), uploadUser.validateContent, userController.createUser);
router.patch('/:id/reset-password', authorize('admin', 'management'), userController.resetUserPassword);
router.put('/:id', authorize('admin', 'management'), uploadUser.safeSingle('staffPhoto'), uploadUser.validateContent, userController.updateUser);
router.delete('/:id', authorize('admin', 'management'), userController.deleteUser);

module.exports = router;
