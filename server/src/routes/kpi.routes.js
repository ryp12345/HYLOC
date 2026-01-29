const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');

// Get all KPIs
router.get('/', kpiController.getAllKPIs);

// Get KPI by ID
router.get('/:id', kpiController.getKPIById);

// Get KPIs by category
router.get('/category/:categoryId', kpiController.getKPIsByCategory);

// Get KPIs by financial year
router.get('/fin-year/:finYear', kpiController.getKPIsByFinYear);

// Create KPI
router.post('/', kpiController.createKPI);

// Update KPI
router.put('/:id', kpiController.updateKPI);

// Delete KPI
router.delete('/:id', kpiController.deleteKPI);

module.exports = router;
