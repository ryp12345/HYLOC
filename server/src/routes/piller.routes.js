const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const pillerController = require('../controllers/piller.controller');

const router = express.Router();

// All piller routes require authentication
router.use(authenticate);

// Get all pillers (accessible by admin and management)
router.get('/', authorize('admin', 'management'), pillerController.getAllPillers);

// Get piller by ID (accessible by admin and management)
router.get('/:id', authorize('admin', 'management'), pillerController.getPillerById);

// Create piller (admin and management)
router.post('/', authorize('admin', 'management'), pillerController.createPiller);

// Update piller (admin and management)
router.put('/:id', authorize('admin', 'management'), pillerController.updatePiller);

// Delete piller (admin and management)
router.delete('/:id', authorize('admin', 'management'), pillerController.deletePiller);

module.exports = router;
