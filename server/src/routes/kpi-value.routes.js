const express = require('express');
const router = express.Router();
const kpiValueController = require('../controllers/kpi-value.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// Only administrators and management may create, change or delete KPI definitions and stored values
const canManageKpis = authorize('admin', 'super admin', 'management');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPI values (with optional kpi_id query parameter)
router.get('/', kpiValueController.getAllKPIValues);

// KPI data audit for one fiscal year (management and administrators) - must be before /:id
router.get('/data-audit', authorize('management', 'admin', 'super admin'), kpiValueController.getDataAudit);

// Get KPI value by data field (query parameter) - must be before /:id
router.get('/by-data', kpiValueController.getKPIValueByData);

// Get KPI values by Pillar ID - must be before /:id
router.get('/pillar/:pillerId', kpiValueController.getKPIValuesByPillar);

// Get KPI values by KPI ID - must be before /:id
router.get('/kpi/:kpiId', kpiValueController.getKPIValuesByKPI);

// Get monthly data for a KPI value - must be before /:id
router.get('/:id/monthly-data/:year', kpiValueController.getMonthlyData);

// Get KPI value by ID
router.get('/:id', kpiValueController.getKPIValueById);

// Create KPI value
router.post('/', canManageKpis, kpiValueController.createKPIValue);

// Update KPI value
router.put('/:id', canManageKpis, kpiValueController.updateKPIValue);

// Delete KPI value
router.delete('/:id', canManageKpis, kpiValueController.deleteKPIValue);

module.exports = router;
