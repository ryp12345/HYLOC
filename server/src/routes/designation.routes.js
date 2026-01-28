const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const designationController = require('../controllers/designation.controller');

const router = express.Router();

// All designation routes require authentication
router.use(authenticate);

// Get all designations (accessible by super_admin and management)
router.get('/', authorize('super_admin', 'management'), designationController.getAllDesignations);

// Get designation by ID (accessible by super_admin and management)
router.get('/:id', authorize('super_admin', 'management'), designationController.getDesignationById);

// Create designation (only super_admin)
router.post('/', authorize('super_admin'), designationController.createDesignation);

// Update designation (only super_admin)
router.put('/:id', authorize('super_admin'), designationController.updateDesignation);

// Delete designation (only super_admin)
router.delete('/:id', authorize('super_admin'), designationController.deleteDesignation);

module.exports = router;
