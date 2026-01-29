const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const roleController = require('../controllers/role.controller');

const router = express.Router();

// All role routes require authentication
router.use(authenticate);

// Get all roles (accessible by admin and management)
router.get('/', authorize('admin', 'management'), roleController.getAllRoles);

// Get role by ID (accessible by admin and management)
router.get('/:id', authorize('admin', 'management'), roleController.getRoleById);

// Create role (only admin)
router.post('/', authorize('admin'), roleController.createRole);

// Update role (only admin)
router.put('/:id', authorize('admin'), roleController.updateRole);

// Delete role (only admin)
router.delete('/:id', authorize('admin'), roleController.deleteRole);

module.exports = router;
