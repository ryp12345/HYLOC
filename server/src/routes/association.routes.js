const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const associationController = require('../controllers/association.controller');

const router = express.Router();

// All association routes require authentication
router.use(authenticate);

// Get all associations (accessible by super_admin and management)
router.get('/', authorize('super_admin', 'management'), associationController.getAllAssociations);

// Get association by ID (accessible by super_admin and management)
router.get('/:id', authorize('super_admin', 'management'), associationController.getAssociationById);

// Create association (only super_admin)
router.post('/', authorize('super_admin'), associationController.createAssociation);

// Update association (only super_admin)
router.put('/:id', authorize('super_admin'), associationController.updateAssociation);

// Delete association (only super_admin)
router.delete('/:id', authorize('super_admin'), associationController.deleteAssociation);

module.exports = router;
