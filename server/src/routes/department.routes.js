const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const departmentController = require('../controllers/department.controller');

const router = express.Router();

// All department routes require authentication
router.use(authenticate);

// Get all departments (accessible by admin, management, and manager)
router.get('/', authorize('admin', 'management', 'manager'), departmentController.getAllDepartments);

// Get department by ID (accessible by admin, management, and manager)
router.get('/:id', authorize('admin', 'management', 'manager'), departmentController.getDepartmentById);

// Create department (only admin)
router.post('/', authorize('admin'), departmentController.createDepartment);

// Update department (only admin)
router.put('/:id', authorize('admin'), departmentController.updateDepartment);

// Delete department (only admin)
router.delete('/:id', authorize('admin'), departmentController.deleteDepartment);

module.exports = router;
