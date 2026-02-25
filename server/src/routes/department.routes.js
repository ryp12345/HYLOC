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

// Create department (only admin)
router.post('/', authorize('admin'), departmentController.createDepartment);

// Update department (only admin)
router.put('/:id', authorize('admin'), departmentController.updateDepartment);

// Delete department (only admin)
router.delete('/:id', authorize('admin'), departmentController.deleteDepartment);

module.exports = router;
