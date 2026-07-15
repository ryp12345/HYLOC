const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const leaveController = require('../controllers/leave.controller');

const router = express.Router();

// All leave routes require authentication
router.use(authenticate);

// Employee, HOD, Management, and HR routes (can apply and manage own leaves)
router.get('/eligibility', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.checkEligibility);
router.get('/department-colleagues', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.getDepartmentColleagues);
router.get('/department-leaves', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.getDepartmentLeaves);
router.post('/', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.applyLeave);
router.get('/my-leaves', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.getMyLeaves);
router.get('/balance', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.getMyBalance);
router.get('/history/:year', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.getLeaveHistory);
router.put('/:id', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.updateLeave);
router.delete('/:id', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.cancelLeave);
router.post('/:id/request-change', authorize('Employee', 'HOD', 'Management', 'HR'), leaveController.requestLeaveChange);

// HOD and Management routes (approval/rejection)
router.get('/pending', authorize('HOD', 'Management'), leaveController.getPendingLeaves);
router.post('/:id/approve', authorize('HOD', 'Management'), leaveController.approveLeave);
router.post('/:id/reject', authorize('HOD', 'Management'), leaveController.rejectLeave);

// Management, HOD and HR routes (view all)
router.get('/all', authorize('Management', 'HOD', 'HR'), leaveController.getAllLeaves);

// Common route (view specific leave - with permission check in controller)
router.get('/:id', leaveController.getLeaveById);

module.exports = router;