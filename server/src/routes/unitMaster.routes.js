const express = require('express');
const router = express.Router();
const unitMasterController = require('../controllers/unitMaster.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(authenticate);

router.get('/', unitMasterController.getAllUnits);
router.get('/:id', unitMasterController.getUnitById);
router.post('/', unitMasterController.createUnit);
router.put('/:id', unitMasterController.updateUnit);
router.delete('/:id', unitMasterController.deleteUnit);

module.exports = router;
