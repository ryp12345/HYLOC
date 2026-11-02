const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const canManageKpis = authorize('admin', 'super admin', 'management');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all KPIs
router.get('/', kpiController.getAllKPIs);

// Get KPIs by category (must be before /:id)
router.get('/category/:categoryId', kpiController.getKPIsByCategory);

// Get KPIs by financial year (must be before /:id)
router.get('/fin-year/:finYear', kpiController.getKPIsByFinYear);

// Get child KPIs by parent ID (must be before /:id)
router.get('/:parentId/children', kpiController.getChildKPIs);

// Get KPI by ID (must be after specific routes)
router.get('/:id', kpiController.getKPIById);

// Create KPI
router.post('/', canManageKpis, kpiController.createKPI);

// Update KPI
router.put('/:id', canManageKpis, kpiController.updateKPI);

// Delete KPI
router.delete('/:id', canManageKpis, kpiController.deleteKPI);

module.exports = router;
