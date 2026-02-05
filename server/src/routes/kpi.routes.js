const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');

// Get all KPIs
router.get('/', kpiController.getAllKPIs);

// Get KPIs by category (must be before /:id)
router.get('/category/:categoryId', kpiController.getKPIsByCategory);

// Get KPIs by financial year (must be before /:id)
router.get('/fin-year/:finYear', kpiController.getKPIsByFinYear);

// Get KPI by ID (must be after specific routes)
router.get('/:id', kpiController.getKPIById);

// Create KPI
router.post('/', kpiController.createKPI);

// Update KPI
router.put('/:id', kpiController.updateKPI);

// Delete KPI
router.delete('/:id', kpiController.deleteKPI);

module.exports = router;
