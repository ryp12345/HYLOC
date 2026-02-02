const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveEntitlementController = require('../controllers/leaveEntitlement.controller');

const router = express.Router();

// All leave entitlement routes require authentication and Admin role
router.use(authenticate);
router.use(authorize('Admin'));

// List entitlements for a year
router.get('/', leaveEntitlementController.listEntitlements);

// List staff with assignment status
router.get('/staff', leaveEntitlementController.listStaffWithStatus);

// Assign leave to a single user
router.post('/assign', leaveEntitlementController.assignLeave);

// Bulk assign leave
router.post('/bulk-assign', leaveEntitlementController.bulkAssignLeave);

// Update entitlement
router.put('/:id', leaveEntitlementController.updateEntitlement);

// Delete entitlement
router.delete('/:id', leaveEntitlementController.deleteEntitlement);

module.exports = router;
