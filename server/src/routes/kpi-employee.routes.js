const express = require('express');
const router = express.Router();
const kpiEmployeeController = require('../controllers/kpi-employee.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const canManageKpis = authorize('admin', 'super admin', 'management');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPI-Employee mappings (with optional kpi_id or emp_id query parameter)
router.get('/', kpiEmployeeController.getAllKPIEmployees);

// Get KPI-Employee mappings by KPI ID
router.get('/kpi/:kpiId', kpiEmployeeController.getKPIEmployeesByKPI);

// Get KPI-Employee mappings by Employee ID
router.get('/employee/:empId', kpiEmployeeController.getKPIEmployeesByEmployee);

// Create KPI-Employee mapping
router.post('/', canManageKpis, kpiEmployeeController.createKPIEmployee);

// Delete KPI-Employee mapping by ID
router.delete('/:id', canManageKpis, kpiEmployeeController.deleteKPIEmployee);

// Delete all KPI-Employee mappings by KPI ID
router.delete('/kpi/:kpiId', canManageKpis, kpiEmployeeController.deleteKPIEmployeesByKPI);

module.exports = router;
