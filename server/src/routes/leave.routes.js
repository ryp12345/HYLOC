const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveController = require('../controllers/leave.controller');

const router = express.Router();

// All leave routes require authentication
router.use(authenticate);

// Employee and Manager routes (can apply and manage own leaves)
router.get('/eligibility', leaveController.checkEligibility);
router.get('/department-colleagues', authorize('Employee', 'Manager'), leaveController.getDepartmentColleagues);
router.post('/', authorize('Employee', 'Manager'), leaveController.applyLeave);
router.get('/my-leaves', authorize('Employee', 'Manager'), leaveController.getMyLeaves);
router.get('/balance', authorize('Employee', 'Manager'), leaveController.getMyBalance);
router.get('/history/:year', authorize('Employee', 'Manager'), leaveController.getLeaveHistory);
router.put('/:id', authorize('Employee', 'Manager'), leaveController.updateLeave);
router.delete('/:id', authorize('Employee', 'Manager'), leaveController.cancelLeave);

// Manager and Management routes (approval/rejection)
router.get('/pending', authorize('Manager', 'Management'), leaveController.getPendingLeaves);
router.post('/:id/approve', authorize('Manager', 'Management'), leaveController.approveLeave);
router.post('/:id/reject', authorize('Manager', 'Management'), leaveController.rejectLeave);

// Management and HR routes (view all)
router.get('/all', authorize('Management', 'HR'), leaveController.getAllLeaves);

// Common route (view specific leave - with permission check in controller)
router.get('/:id', leaveController.getLeaveById);

module.exports = router;
