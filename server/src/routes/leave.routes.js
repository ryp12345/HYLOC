const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveController = require('../controllers/leave.controller');

const router = express.Router();

// All leave routes require authentication
router.use(authenticate);

// Employee, Manager, Management, and HR routes (can apply and manage own leaves)
router.get('/eligibility', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.checkEligibility);
router.get('/department-colleagues', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.getDepartmentColleagues);
router.get('/department-leaves', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.getDepartmentLeaves);
router.post('/', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.applyLeave);
router.get('/my-leaves', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.getMyLeaves);
router.get('/balance', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.getMyBalance);
router.get('/history/:year', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.getLeaveHistory);
router.put('/:id', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.updateLeave);
router.delete('/:id', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.cancelLeave);
router.post('/:id/request-change', authorize('Employee', 'Manager', 'Management', 'HR'), leaveController.requestLeaveChange);

// Manager and Management routes (approval/rejection)
router.get('/pending', authorize('Manager', 'Management'), leaveController.getPendingLeaves);
router.post('/:id/approve', authorize('Manager', 'Management'), leaveController.approveLeave);
router.post('/:id/reject', authorize('Manager', 'Management'), leaveController.rejectLeave);

// Management and Manager routes (view all)
router.get('/all', authorize('Management', 'Manager'), leaveController.getAllLeaves);

// Common route (view specific leave - with permission check in controller)
router.get('/:id', leaveController.getLeaveById);

module.exports = router;