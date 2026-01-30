const leaveService = require('../services/leave.service');
const leaveModel = require('../models/leave.model');
const entitlementModel = require('../models/leaveEntitlement.model');
const userModel = require('../models/user.model');
const db = require('../config/db');

/**
 * Check eligibility to apply for leave
 * GET /api/leaves/eligibility
 */
exports.checkEligibility = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const eligibility = await leaveService.checkLeaveEligibility(userId, userRole);
    
    res.status(200).json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Apply for leave
 * POST /api/leaves
 */
exports.applyLeave = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Validate required fields
    if (!req.body.from_date || !req.body.leave_reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_date, leave_reason'
      });
    }
    
    const leaveRecord = await leaveService.applyLeave(userId, req.body, userRole);
    
    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: leaveRecord
    });
  } catch (error) {
    if (error.message.includes('eligible') || error.message.includes('role')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        canApply: false
      });
    }
    
    if (error.message.includes('date') || error.message.includes('format')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get my leaves (current user)
 * GET /api/leaves/my-leaves
 */
exports.getMyLeaves = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const filters = {
      status: req.query.status,
      year: req.query.year,
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const leaves = await leaveModel.getLeavesByUserId(userId, filters);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave by ID
 * GET /api/leaves/:id
 */
exports.getLeaveById = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const leave = await leaveModel.getLeaveById(leaveId);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    // Check if user can view this leave
    // Employee/Manager can only view their own
    if (['Employee', 'Manager'].includes(req.user.role) && leave.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only view your own leaves'
      });
    }
    
    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update pending leave
 * PUT /api/leaves/:id
 */
exports.updateLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const updatedLeave = await leaveService.updatePendingLeave(
      leaveId,
      userId,
      req.body,
      userRole
    );
    
    res.status(200).json({
      success: true,
      message: 'Leave updated successfully',
      data: updatedLeave
    });
  } catch (error) {
    if (error.message === 'Leave not found') {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    if (error.message.includes('Forbidden')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('pending')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('date')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Cancel (delete) pending leave
 * DELETE /api/leaves/:id
 */
exports.cancelLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const result = await leaveService.cancelLeave(leaveId, userId, userRole);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === 'Leave not found') {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    if (error.message.includes('Forbidden')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('pending') || error.message.includes('consumed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get my leave balance
 * GET /api/leaves/balance
 */
exports.getMyBalance = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    
    const balance = await leaveService.getLeaveBalance(userId, year);
    
    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get department colleagues for alternate person selection
 * GET /api/leaves/department-colleagues
 */
exports.getDepartmentColleagues = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    console.log('Getting colleagues for userId:', userId);
    
    // Get user's department
    const user = await userModel.findUserById(userId);
    console.log('User found:', user ? `ID: ${user.id}, Dept: ${user.department_id}` : 'Not found');
    
    if (!user || !user.department_id) {
      console.log('No department_id found for user');
      return res.status(200).json({
        success: true,
        data: [],
        message: 'User has no department assigned'
      });
    }
    
    // Get users from same department
    const colleagues = await userModel.getUsersByDepartment(user.department_id);
    console.log('Colleagues from department', user.department_id, ':', colleagues.length);
    
    // Remove current user from list
    const filteredColleagues = colleagues.filter(c => c.id !== userId);
    console.log('Filtered colleagues:', filteredColleagues.length);
    
    res.status(200).json({
      success: true,
      data: filteredColleagues
    });
  } catch (error) {
    console.error('Error getting colleagues:', error);
    next(error);
  }
};

/**
 * Get leave history for a specific year
 * GET /api/leaves/history/:year
 */
exports.getLeaveHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const year = parseInt(req.params.year);
    
    const leaves = await leaveModel.getLeaveHistoryByYear(userId, year);
    
    res.status(200).json({
      success: true,
      year: year,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all pending leaves (for Manager/Management approval)
 * GET /api/leaves/pending
 */
exports.getPendingLeaves = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    // Only Manager and Management can view pending approvals
    if (!['Manager', 'Management'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Manager and Management can view pending approvals'
      });
    }
    
    const filters = {};
    
    // Management sees leaves > 2 days only
    if (userRole === 'Management') {
      filters.min_duration = 2;
    }
    
    // Manager sees leaves from their department (if applicable)
    if (userRole === 'Manager' && req.query.department_id) {
      filters.department_id = parseInt(req.query.department_id);
    }
    
    const leaves = await leaveModel.getPendingLeaves(filters);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all leaves (for Management/HR)
 * GET /api/leaves/all
 */
exports.getAllLeaves = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    // Only Management and HR can view all leaves
    if (!['Management', 'HR'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Management and HR can view all leaves'
      });
    }
    
    const filters = {
      status: req.query.status,
      department_id: req.query.department_id,
      year: req.query.year,
      min_duration: req.query.min_duration
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const leaves = await leaveModel.getAllLeaves(filters);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve leave (for Manager/Management)
 * POST /api/leaves/:id/approve
 */
exports.approveLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const approverId = req.user.userId;
    const userRole = req.user.role;
    
    // Only Manager and Management can approve
    if (!['Manager', 'Management'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Manager and Management can approve leaves'
      });
    }
    
    // Get leave details to check duration
    const leave = await leaveModel.getLeaveById(leaveId);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave is not in pending status'
      });
    }
    
    // Get leave applicant's role
    const roleQuery = `
      SELECT r.role_name 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `;
    const roleResult = await db.query(roleQuery, [leave.user_id]);
    const applicantRole = roleResult.rows[0]?.role_name;
    
    // If leave is from a Manager, only Management can approve (no duration restriction)
    if (applicantRole === 'Manager') {
      if (userRole !== 'Management') {
        return res.status(403).json({
          success: false,
          message: 'Only Management can approve Manager\'s leaves'
        });
      }
      // Management approving Manager's leave - no duration restriction, proceed
    } else if (applicantRole === 'Employee') {
      // Leave is from Employee - apply duration-based rules
      // Manager can only approve leaves <= 2 days
      if (userRole === 'Manager' && parseFloat(leave.credited_days) > 2) {
        return res.status(403).json({
          success: false,
          message: 'Manager can only approve leaves of 2 days or less. This leave requires Management approval.'
        });
      }
      
      // Management can only approve leaves > 2 days
      if (userRole === 'Management' && parseFloat(leave.credited_days) <= 2) {
        return res.status(403).json({
          success: false,
          message: 'Management approves leaves greater than 2 days only. This leave should be approved by Manager.'
        });
      }
    }
    
    const approvedLeave = await leaveModel.approveLeave(leaveId, approverId);
    
    res.status(200).json({
      success: true,
      message: 'Leave approved successfully',
      data: approvedLeave
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject leave (for Manager/Management)
 * POST /api/leaves/:id/reject
 */
exports.rejectLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const rejectorId = req.user.userId;
    const userRole = req.user.role;
    const rejectionReason = req.body.rejection_reason || 'No reason provided';
    
    // Only Manager and Management can reject
    if (!['Manager', 'Management'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Manager and Management can reject leaves'
      });
    }
    
    // Get leave details to check duration
    const leave = await leaveModel.getLeaveById(leaveId);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave is not in pending status'
      });
    }
    
    // Get leave applicant's role
    const roleQuery = `
      SELECT r.role_name 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `;
    const roleResult = await db.query(roleQuery, [leave.user_id]);
    const applicantRole = roleResult.rows[0]?.role_name;
    
    // If leave is from a Manager, only Management can reject (no duration restriction)
    if (applicantRole === 'Manager') {
      if (userRole !== 'Management') {
        return res.status(403).json({
          success: false,
          message: 'Only Management can reject Manager\'s leaves'
        });
      }
      // Management rejecting Manager's leave - no duration restriction, proceed
    } else if (applicantRole === 'Employee') {
      // Leave is from Employee - apply duration-based rules
      // Same approval rules apply for rejection
      if (userRole === 'Manager' && parseFloat(leave.credited_days) > 2) {
        return res.status(403).json({
          success: false,
          message: 'Manager can only handle leaves of 2 days or less.'
        });
      }
      
      if (userRole === 'Management' && parseFloat(leave.credited_days) <= 2) {
        return res.status(403).json({
          success: false,
          message: 'Management handles leaves greater than 2 days only.'
        });
      }
    }
    
    const rejectedLeave = await leaveModel.rejectLeave(leaveId, rejectorId, rejectionReason);
    
    res.status(200).json({
      success: true,
      message: 'Leave rejected',
      data: rejectedLeave
    });
  } catch (error) {
    next(error);
  }
};
