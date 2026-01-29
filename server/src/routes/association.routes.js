const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const associationController = require('../controllers/association.controller');

const router = express.Router();

// All association routes require authentication
router.use(authenticate);

// Get all associations (accessible by admin and management)
router.get('/', authorize('admin', 'management'), associationController.getAllAssociations);

// Get association by ID (accessible by admin and management)
router.get('/:id', authorize('admin', 'management'), associationController.getAssociationById);

// Create association (only admin)
router.post('/', authorize('admin'), associationController.createAssociation);

// Update association (only admin)
router.put('/:id', authorize('admin'), associationController.updateAssociation);

// Delete association (only admin)
router.delete('/:id', authorize('admin'), associationController.deleteAssociation);

module.exports = router;
