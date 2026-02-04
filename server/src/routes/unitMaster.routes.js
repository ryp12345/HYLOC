const express = require('express');
const router = express.Router();
const unitMasterController = require('../controllers/unitMaster.controller');

router.get('/', unitMasterController.getAllUnits);
router.get('/:id', unitMasterController.getUnitById);
router.post('/', unitMasterController.createUnit);
router.put('/:id', unitMasterController.updateUnit);
router.delete('/:id', unitMasterController.deleteUnit);

module.exports = router;
