const express = require('express');
const unitController = require('../controllers/unit.controller');

const router = express.Router();

router.get('/', unitController.getAllUnits);

module.exports = router;