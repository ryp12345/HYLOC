const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const departmentController = require('../controllers/department.controller');

const router = express.Router();

// All department routes require authentication
router.use(authenticate);

// Get all departments (accessible by super_admin and management)
router.get('/', authorize('super_admin', 'management'), departmentController.getAllDepartments);

// Get department by ID (accessible by super_admin and management)
router.get('/:id', authorize('super_admin', 'management'), departmentController.getDepartmentById);

// Create department (only super_admin)
router.post('/', authorize('super_admin'), departmentController.createDepartment);

// Update department (only super_admin)
router.put('/:id', authorize('super_admin'), departmentController.updateDepartment);

// Delete department (only super_admin)
router.delete('/:id', authorize('super_admin'), departmentController.deleteDepartment);

module.exports = router;
