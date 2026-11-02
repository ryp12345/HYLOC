const express = require('express');
const router = express.Router();
const kpiDepartmentController = require('../controllers/kpi-department.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const canManageKpis = authorize('admin', 'super admin', 'management');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPI-Department mappings (with optional kpi_id query parameter)
router.get('/', kpiDepartmentController.getAllKPIDepartments);

// Get KPI-Department mappings by KPI ID
router.get('/kpi/:kpiId', kpiDepartmentController.getKPIDepartmentsByKPI);

// Get KPI-Department mappings by Department ID
router.get('/department/:departmentId', kpiDepartmentController.getKPIDepartmentsByDepartment);

// Create KPI-Department mapping
router.post('/', canManageKpis, kpiDepartmentController.createKPIDepartment);

// Delete KPI-Department mapping by ID
router.delete('/:id', canManageKpis, kpiDepartmentController.deleteKPIDepartment);

// Delete all KPI-Department mappings by KPI ID
router.delete('/kpi/:kpiId', canManageKpis, kpiDepartmentController.deleteKPIDepartmentsByKPI);

module.exports = router;
