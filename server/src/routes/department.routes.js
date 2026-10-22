const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const departmentController = require('../controllers/department.controller');

const router = express.Router();

// All department routes require authentication
router.use(authenticate);

// Get all departments (accessible by any authenticated user)
router.get('/', departmentController.getAllDepartments);

// Get department by ID (accessible by any authenticated user)
router.get('/:id', departmentController.getDepartmentById);

// Create department (admin and management)
router.post('/', authorize('admin', 'management'), departmentController.createDepartment);

// Update department (admin and management)
router.put('/:id', authorize('admin', 'management'), departmentController.updateDepartment);

// Delete department (admin and management)
router.delete('/:id', authorize('admin', 'management'), departmentController.deleteDepartment);

module.exports = router;
