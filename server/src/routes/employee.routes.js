const express = require('express');
const router = express.Router();
const employeeKpiController = require('../controllers/employee.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/employees/:empId/kpi-values - Get all KPI values for an employee
router.get('/:empId/kpi-values', employeeKpiController.getEmployeeKPIValues);

// GET /api/employees/:empId/kpis - Get all KPIs for an employee
router.get('/:empId/kpis', employeeKpiController.getEmployeeKPIs);

// GET /api/employees/:empId/kpis/:kpiId/values - Get KPI values for specific KPI for an employee
router.get('/:empId/kpis/:kpiId/values', employeeKpiController.getKPIValueForEmployee);

// GET /api/employees/kpi/:kpiId/assignees - Get employees assigned to a KPI
router.get('/kpi/:kpiId/assignees', employeeKpiController.getKPIAssignees);

// POST /api/employees/kpi-data - Submit monthly KPI data
router.post('/kpi-data', employeeKpiController.submitKPIData);

module.exports = router;
