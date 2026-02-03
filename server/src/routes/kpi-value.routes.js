const express = require('express');
const router = express.Router();
const kpiValueController = require('../controllers/kpi-value.controller');

// Get all KPI values (with optional kpi_id query parameter)
router.get('/', kpiValueController.getAllKPIValues);

// Get KPI value by ID
router.get('/:id', kpiValueController.getKPIValueById);

// Get monthly data for a KPI value for a specific year
router.get('/:id/monthly-data/:year', kpiValueController.getMonthlyData);

// Get KPI values by KPI ID
router.get('/kpi/:kpiId', kpiValueController.getKPIValuesByKPI);

// Create KPI value
router.post('/', kpiValueController.createKPIValue);

// Update KPI value
router.put('/:id', kpiValueController.updateKPIValue);

// Delete KPI value
router.delete('/:id', kpiValueController.deleteKPIValue);

module.exports = router;
