const express = require('express');
const router = express.Router();
const kpiValueController = require('../controllers/kpi-value.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPI values (with optional kpi_id query parameter)
router.get('/', kpiValueController.getAllKPIValues);

// Get KPI value by data field (query parameter) - must be before /:id
router.get('/by-data', kpiValueController.getKPIValueByData);

// Get KPI values by KPI ID - must be before /:id
router.get('/kpi/:kpiId', kpiValueController.getKPIValuesByKPI);

// Get KPI value by ID
router.get('/:id', kpiValueController.getKPIValueById);

// Create KPI value
router.post('/', kpiValueController.createKPIValue);

// Update KPI value
router.put('/:id', kpiValueController.updateKPIValue);

// Delete KPI value
router.delete('/:id', kpiValueController.deleteKPIValue);

module.exports = router;
