const express = require('express');
const router = express.Router();
const unitMasterController = require('../controllers/unitMaster.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const canManageKpis = authorize('admin', 'super admin', 'management');

// Apply authentication middleware to all routes
router.use(authenticate);

router.get('/', unitMasterController.getAllUnits);
router.get('/:id', unitMasterController.getUnitById);
router.post('/', canManageKpis, unitMasterController.createUnit);
router.put('/:id', canManageKpis, unitMasterController.updateUnit);
router.delete('/:id', canManageKpis, unitMasterController.deleteUnit);

module.exports = router;
