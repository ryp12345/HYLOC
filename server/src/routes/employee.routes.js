const express = require('express');
const router = express.Router();
const employeeKpiController = require('../controllers/employee-kpi.controller');

// GET /api/employees/:empId/kpi-values - Get all KPI values for an employee
router.get('/:empId/kpi-values', employeeKpiController.getEmployeeKPIValues);

// GET /api/employees/:empId/kpis - Get all KPIs for an employee
router.get('/:empId/kpis', employeeKpiController.getEmployeeKPIs);

// GET /api/employees/:empId/kpis/:kpiId/values - Get KPI values for specific KPI for an employee
router.get('/:empId/kpis/:kpiId/values', employeeKpiController.getKPIValueForEmployee);

// POST /api/employees/kpi-data - Submit monthly KPI data
router.post('/kpi-data', employeeKpiController.submitKPIData);

module.exports = router;
