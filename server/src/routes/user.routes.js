const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const uploadUser = require('../middlewares/uploadUser.middleware');
const userController = require('../controllers/user.controller');
const userModel = require('../models/user.model');

const router = express.Router();

const seedExistingEmpidForUpload = async (req, res, next) => {
	try {
		if (String(req.body?.empid || '').trim()) {
			return next();
		}

		const userId = req.params?.id || req.user?.userId;
		if (!userId) {
			return next();
		}

		const existingUser = await userModel.findUserById(userId);
		if (existingUser?.empid) {
			req.body = req.body || {};
			req.body.empid = existingUser.empid;
		}
	} catch (error) {
		console.error('Failed to seed empid for staff photo upload:', error.message);
	}

	return next();
};

// All user routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', userController.getMyProfile);

// Update current user profile
router.put('/me', seedExistingEmpidForUpload, uploadUser.single('staffPhoto'), userController.updateMyProfile);

// Minimal list of assignable users (any authenticated user)
router.get('/assignable', userController.getAssignableUsers);

// Super admin, management and HR routes
router.get('/', authorize('admin', 'management', 'HR'), userController.getAllUsers);
router.get('/department/:id', authorize('admin', 'management', 'manager'), userController.getUsersByDepartment);
router.get('/:id', userController.getUserById);
router.post('/', authorize('admin'), uploadUser.single('staffPhoto'), userController.createUser);
router.patch('/:id/reset-password', authorize('admin', 'management'), userController.resetUserPassword);
router.put('/:id', authorize('admin'), seedExistingEmpidForUpload, uploadUser.single('staffPhoto'), userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
