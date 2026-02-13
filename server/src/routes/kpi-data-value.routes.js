const express = require('express');
const router = express.Router();
const kpiDataValueController = require('../controllers/kpi-data-value.controller');

// Get all KPI data values
router.get('/', kpiDataValueController.getAllKPIDataValues);

// Get monthly data by KPI Value ID
router.get('/:kpiValueId/monthly', kpiDataValueController.getMonthlyDataByKPIValue);

// Get data for multiple KPI values
router.post('/multiple', kpiDataValueController.getMultipleKPIValuesData);

// Get KPI data value by ID
router.get('/:id', kpiDataValueController.getKPIDataValueById);

// Create KPI data value
router.post('/', kpiDataValueController.createKPIDataValue);

// Update KPI data value
router.put('/:id', kpiDataValueController.updateKPIDataValue);

// Delete KPI data value
router.delete('/:id', kpiDataValueController.deleteKPIDataValue);

module.exports = router;
