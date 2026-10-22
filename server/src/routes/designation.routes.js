const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const designationController = require('../controllers/designation.controller');

const router = express.Router();

// All designation routes require authentication
router.use(authenticate);

// Get all designations (accessible by any authenticated user)
router.get('/', designationController.getAllDesignations);

// Get designation by ID (accessible by any authenticated user)
router.get('/:id', designationController.getDesignationById);

// Create designation (admin and management)
router.post('/', authorize('admin', 'management'), designationController.createDesignation);

// Update designation (admin and management)
router.put('/:id', authorize('admin', 'management'), designationController.updateDesignation);

// Delete designation (admin and management)
router.delete('/:id', authorize('admin', 'management'), designationController.deleteDesignation);

module.exports = router;
