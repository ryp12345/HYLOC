const express = require('express');
const router = express.Router();
const kpiDataValueController = require('../controllers/kpi-data-value.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// Only administrators may create, change or delete KPI definitions and stored values
const canManageKpis = authorize('admin', 'super admin');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPI data values
router.get('/', kpiDataValueController.getAllKPIDataValues);

// Get monthly data by KPI Value ID
router.get('/:kpiValueId/monthly', kpiDataValueController.getMonthlyDataByKPIValue);

// Get data for multiple KPI values
router.post('/multiple', kpiDataValueController.getMultipleKPIValuesData);

// Get KPI data value by ID
router.get('/:id', kpiDataValueController.getKPIDataValueById);

// Create KPI data value
router.post('/', canManageKpis, kpiDataValueController.createKPIDataValue);

// Update KPI data value
router.put('/:id', canManageKpis, kpiDataValueController.updateKPIDataValue);

// Delete KPI data value
router.delete('/:id', canManageKpis, kpiDataValueController.deleteKPIDataValue);

module.exports = router;
