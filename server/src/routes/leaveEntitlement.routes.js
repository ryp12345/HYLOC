const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveEntitlementController = require('../controllers/leaveEntitlement.controller');

const router = express.Router();

// All leave entitlement routes require authentication and Admin role
router.use(authenticate);
router.use(authorize('admin'));

// List entitlements for a year
router.get('/', leaveEntitlementController.listEntitlements);

// List staff with assignment status
router.get('/staff', leaveEntitlementController.listStaffWithStatus);

// List staff with current-year monthly working-day status for a selected month
router.get('/monthly/staff', leaveEntitlementController.listStaffWithMonthlyWorkingDaysStatus);

// Import current-year monthly working days for a selected month
router.post('/monthly/import', leaveEntitlementController.importMonthlyWorkingDays);

// Import leave entitlements from uploaded template rows
router.post('/import', leaveEntitlementController.importEntitlements);

// Update entitlement
router.put('/:id', leaveEntitlementController.updateEntitlement);

// Delete entitlement
router.delete('/:id', leaveEntitlementController.deleteEntitlement);

module.exports = router;
