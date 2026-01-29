const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const designationController = require('../controllers/designation.controller');

const router = express.Router();

// All designation routes require authentication
router.use(authenticate);

// Get all designations (accessible by admin and management)
router.get('/', authorize('admin', 'management'), designationController.getAllDesignations);

// Get designation by ID (accessible by admin and management)
router.get('/:id', authorize('admin', 'management'), designationController.getDesignationById);

// Create designation (only admin)
router.post('/', authorize('admin'), designationController.createDesignation);

// Update designation (only admin)
router.put('/:id', authorize('admin'), designationController.updateDesignation);

// Delete designation (only admin)
router.delete('/:id', authorize('admin'), designationController.deleteDesignation);

module.exports = router;
