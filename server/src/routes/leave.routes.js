const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveController = require('../controllers/leave.controller');

const router = express.Router();

// All leave routes require authentication
router.use(authenticate);

// Employee, Manager, and Management routes (can apply and manage own leaves)
router.get('/eligibility', leaveController.checkEligibility);
router.get('/department-colleagues', authorize('Employee', 'Manager', 'Management'), leaveController.getDepartmentColleagues);
router.get('/department-leaves', authorize('Employee', 'Manager', 'Management'), leaveController.getDepartmentLeaves);
router.post('/', authorize('Employee', 'Manager', 'Management'), leaveController.applyLeave);
router.get('/my-leaves', authorize('Employee', 'Manager', 'Management'), leaveController.getMyLeaves);
router.get('/balance', authorize('Employee', 'Manager', 'Management'), leaveController.getMyBalance);
router.get('/history/:year', authorize('Employee', 'Manager', 'Management'), leaveController.getLeaveHistory);
router.put('/:id', authorize('Employee', 'Manager', 'Management'), leaveController.updateLeave);
router.delete('/:id', authorize('Employee', 'Manager', 'Management'), leaveController.cancelLeave);

// Manager and Management routes (approval/rejection)
router.get('/pending', authorize('Manager', 'Management'), leaveController.getPendingLeaves);
router.post('/:id/approve', authorize('Manager', 'Management'), leaveController.approveLeave);
router.post('/:id/reject', authorize('Manager', 'Management'), leaveController.rejectLeave);

// Management and Manager routes (view all)
router.get('/all', authorize('Management', 'Manager'), leaveController.getAllLeaves);

// Common route (view specific leave - with permission check in controller)
router.get('/:id', leaveController.getLeaveById);

module.exports = router;