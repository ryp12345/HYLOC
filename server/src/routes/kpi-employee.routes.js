const express = require('express');
const router = express.Router();
const kpiEmployeeController = require('../controllers/kpi-employee.controller');

// Get all KPI-Employee mappings (with optional kpi_id or emp_id query parameter)
router.get('/', kpiEmployeeController.getAllKPIEmployees);

// Get KPI-Employee mappings by KPI ID
router.get('/kpi/:kpiId', kpiEmployeeController.getKPIEmployeesByKPI);

// Get KPI-Employee mappings by Employee ID
router.get('/employee/:empId', kpiEmployeeController.getKPIEmployeesByEmployee);

// Create KPI-Employee mapping
router.post('/', kpiEmployeeController.createKPIEmployee);

// Delete KPI-Employee mapping by ID
router.delete('/:id', kpiEmployeeController.deleteKPIEmployee);

// Delete all KPI-Employee mappings by KPI ID
router.delete('/kpi/:kpiId', kpiEmployeeController.deleteKPIEmployeesByKPI);

module.exports = router;
