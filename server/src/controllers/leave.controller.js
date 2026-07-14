const leaveService = require('../services/leave.service');
const leaveModel = require('../models/leave.model');
const entitlementModel = require('../models/leaveEntitlement.model');
const userModel = require('../models/user.model');
const notificationModel = require('../models/notification.model');
const db = require('../config/db');

// Helper to format a date as 'Thu Mar 19 2026' (no time or timezone)
const formatDate = (d) => {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toDateString();
};

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

    // Send notification to department managers when an Employee applies for leave
    try {
      const normalizedRole = (userRole || '').toLowerCase();
      if (normalizedRole === 'employee') {
        const notificationModel = require('../models/notification.model');
        const applicant = await userModel.findUserById(userId);
        if (applicant && applicant.department_id) {
          const managers = await userModel.getManagersByDepartment(applicant.department_id);
          if (managers && managers.length > 0) {
            const applicantName = [applicant.firstname, applicant.lastname].filter(Boolean).join(' ');
            const fromDate = req.body.from_date;
            const toDate = req.body.to_date;
            const leaveType = req.body.leave_type || 'Leave';
            let dateText = fromDate;
            if (toDate && fromDate !== toDate) {
              dateText = `${fromDate} to ${toDate}`;
            }
            // Deduplicate manager IDs in case of duplicate rows
            const uniqueManagerIds = Array.from(new Set((managers || []).map(m => m && m.id).filter(Boolean)));
            for (const managerId of uniqueManagerIds) {
              await notificationModel.createNotification({
                created_by: userId,
                assigned_to: managerId,
                message: `${applicantName} from your department has applied for ${leaveType}  from ${dateText}.`,
                type: 'leave',
                is_read: false
              });
            }
          }
        }
      }
    } catch (notifyErr) {
      // Log error but don't block leave application
      console.error('Manager notification error:', notifyErr);
    }

    // Send notification to alternate person if present//////////////////////
    if (req.body.alternate_person) {
      try {
        const notificationModel = require('../models/notification.model');
        const altUser = await userModel.findUserByEmpid(req.body.alternate_person);
        const applicant = await userModel.findUserById(userId);
        if (altUser && altUser.id && applicant) {
          const applicantName = [applicant.firstname, applicant.lastname].filter(Boolean).join(' ');
          const fromDate = req.body.from_date;
          const toDate = req.body.to_date;
          const leaveType = req.body.leave_type || 'Leave';
          let dateText = fromDate;
          if (toDate && fromDate !== toDate) {
            dateText = `${fromDate} to ${toDate}`;
          }
          await notificationModel.createNotification({
            created_by: userId,
            assigned_to: altUser.id,
            message: `${applicantName} has applied for ${leaveType} leave from ${dateText} and assigned you as an alternate person.`,
            type: 'leave',
            is_read: false
          });
        }
      } catch (notifyErr) {
        // Log error but don't block leave application
        console.error('Notification error:', notifyErr);
      }
    }
    // Notify Management for long (>2 days) Employee leave applications
    try {
      const normalizedRole = (userRole || '').toLowerCase();
      if (normalizedRole === 'employee') {
        const { creditedDays } = leaveService.calculateCreditedDays(
          req.body.from_date,
          req.body.to_date || req.body.from_date,
          req.body.leave_duration || 'Full Day'
        );

        if (Number(creditedDays) > 2) {
          const mgmtResult = await db.query(
            `
              SELECT u.id
              FROM users u
              JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
              JOIN roles r ON r.id = ur.role_id
              WHERE u.status = 'active'
                AND LOWER(r.role_name) = 'management'
            `
          );

          const managers = mgmtResult.rows || [];
          const applicant = await userModel.findUserById(userId);
          const applicantName = [applicant?.firstname, applicant?.lastname].filter(Boolean).join(' ') || 'Employee';
          const fromDate = req.body.from_date;
          const toDate = req.body.to_date;
          const leaveType = req.body.leave_type || 'Leave';
          let dateText = fromDate;
          if (toDate && fromDate !== toDate) {
            dateText = `${fromDate} to ${toDate}`;
          }

          // Deduplicate management recipient IDs before creating notifications
          const uniqueMgmtIds = Array.from(new Set((managers || []).map(m => m && m.id).filter(Boolean)));
          for (const mgmtId of uniqueMgmtIds) {
            await notificationModel.createNotification({
              created_by: userId,
              assigned_to: mgmtId,
              message: `${applicantName} has applied for ${leaveType} leave from ${dateText}. Please review if necessary.`,
              type: 'leave',
              is_read: false
            });
          }
        }
      }
    } catch (mgmtNotifyErr) {
      console.error('Management notification error:', mgmtNotifyErr);
    }
    /////////////////////////notification code////////////////////////////

    // Return appropriate message based on role
    const message = userRole === 'Management' 
      ? 'Leave application submitted and automatically approved'
      : 'Leave application submitted successfully';

    res.status(201).json({
      success: true,
      message: message,
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
    
    if (error.message.includes('leave balance')) {
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
    const previousLeave = await leaveModel.getLeaveById(leaveId);

    if (!previousLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }
    
    const updatedLeave = await leaveService.updatePendingLeave(
      leaveId,
      userId,
      req.body,
      userRole
    );

    const normalizedRole = String(userRole || '').toLowerCase();
    const isApprover = normalizedRole === 'manager' || normalizedRole === 'management';
    const movedBackToPending = ['Approved', 'Rejected'].includes(previousLeave.status) && updatedLeave?.status === 'Pending';
    const updatedByApprover = isApprover && previousLeave.user_id !== userId;

    if (movedBackToPending && updatedByApprover) {
      try {
        const fFrom = formatDate(previousLeave.from_date);
        const fTo = formatDate(previousLeave.to_date);
        const dateText = fTo && fFrom !== fTo ? `${fFrom} to ${fTo}` : fFrom;
        await notificationModel.createNotification({
          created_by: userId,
          assigned_to: previousLeave.user_id,
          message: `Your leave request change has been permitted for ${dateText}. You can now edit or cancel the leave request.`,
          type: 'Leave',
          is_read: false
        });
      } catch (notifyErr) {
        console.error('Notification error (allow leave change):', notifyErr);
      }
    }

    // Notify applicant when approver changes status to Approved/Rejected
    try {
      const newStatus = updatedLeave?.status;
      const oldStatus = previousLeave?.status;
      if (updatedByApprover && newStatus && oldStatus !== newStatus && ['Approved', 'Rejected'].includes(newStatus)) {
        const fFrom = formatDate(previousLeave.from_date);
        const fTo = formatDate(previousLeave.to_date);
        const dateText = fTo && fFrom !== fTo ? `${fFrom} to ${fTo}` : fFrom;
        const statusText = newStatus === 'Approved' ? 'approved' : 'rejected';
        await notificationModel.createNotification({
          created_by: userId,
          assigned_to: previousLeave.user_id,
          message: `Your leave request for ${dateText} has been ${statusText}.`,
          type: 'Leave',
          is_read: false
        });
      }
    } catch (notifyErr) {
      console.error('Notification error (status change):', notifyErr);
    }

    const responseMessage = movedBackToPending && updatedByApprover
      ? 'Leave request change success'
      : 'Leave updated successfully';
    
    res.status(200).json({
      success: true,
      message: responseMessage,
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
 * Request leave change unlock for approved/rejected leave
 * POST /api/leaves/:id/request-change
 */
exports.requestLeaveChange = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (String(userRole || '').toLowerCase() !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Only Employee can request leave change unlock'
      });
    }

    const leave = await leaveModel.getLeaveById(leaveId);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found'
      });
    }

    if (leave.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only request change for your own leave'
      });
    }

    if (!['Approved', 'Rejected'].includes(leave.status)) {
      return res.status(400).json({
        success: false,
        message: 'Change request is allowed only for Approved/Rejected leaves'
      });
    }

    const applicant = await userModel.findUserById(userId);
    const applicantName = [applicant?.firstname, applicant?.lastname].filter(Boolean).join(' ') || 'Employee';
    const fFrom = formatDate(leave.from_date);
    const fTo = formatDate(leave.to_date);
    const dateText = fTo && fFrom !== fTo ? `${fFrom} to ${fTo}` : fFrom;

    let recipients = [];
    const creditedDays = Number(leave.credited_days || 0);

    if (creditedDays > 2) {
      const mgmtResult = await db.query(
        `
          SELECT u.id
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
          JOIN roles r ON r.id = ur.role_id
          WHERE u.status = 'active'
            AND LOWER(r.role_name) = 'management'
        `
      );
      recipients = mgmtResult.rows || [];
    } else {
      const managers = await userModel.getManagersByDepartment(applicant?.department_id);
      recipients = managers || [];
    }

    const uniqueRecipientIds = Array.from(new Set((recipients || []).map(r => Number(r.id)).filter(Boolean)));

    if (uniqueRecipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No approver found for this leave change request'
      });
    }

    for (const recipientId of uniqueRecipientIds) {
      if (recipientId === Number(userId)) continue;
      await notificationModel.createNotification({
        created_by: userId,
        assigned_to: recipientId,
        message: `${applicantName} requested to modify a ${leave.status.toLowerCase()} leave (${dateText}). Please review and allow leave request change if appropriate.`,
        type: 'Leave',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message: 'Leave request change success'
    });
  } catch (error) {
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
    
    //console.log('Getting colleagues for userId:', userId);
    
    // Get user's department
    const user = await userModel.findUserById(userId);
    //console.log('User found:', user ? `ID: ${user.id}, Dept: ${user.department_id}` : 'Not found');
    
    if (!user || !user.department_id) {
     // console.log('No department_id found for user');
      return res.status(200).json({
        success: true,
        data: [],
        message: 'User has no department assigned'
      });
    }
    
    // Get users from same department
    const colleagues = await userModel.getUsersByDepartment(user.department_id);
    //console.log('Colleagues from department', user.department_id, ':', colleagues.length);
    
    // Remove current user from list
    const filteredColleagues = colleagues.filter(c => c.id !== userId);
    //console.log('Filtered colleagues:', filteredColleagues.length);
    
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
 * Get all leaves (for Management)
 * GET /api/leaves/all
 */
exports.getAllLeaves = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    // Only Management and Manager can view all leaves
    if (!['Management', 'Manager'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Management and Manager can view all leaves'
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
    
    // Management can approve any leave (Manager or Employee)
    if (userRole === 'Management') {
      // proceed
    } else if (userRole === 'Manager') {
      // Manager can only approve Employee leaves
      if (applicantRole !== 'Employee') {
        return res.status(403).json({
          success: false,
          message: 'Manager can only approve leaves of Employees.'
        });
      }
      // proceed
    }
    
    const approvedLeave = await leaveModel.approveLeave(leaveId, approverId);
    // Notify applicant about approval
    try {
      const fromDate = leave.from_date;
      const toDate = leave.to_date;
      const fFrom = formatDate(fromDate);
      const fTo = formatDate(toDate);
      let dateText = fFrom;
      if (fTo && fFrom !== fTo) {
        dateText = `${fFrom} to ${fTo}`;
      }
      await notificationModel.createNotification({
        created_by: approverId,
        assigned_to: leave.user_id,
        message: `Your leave request change from ${dateText} has been Approved.`,
        type: 'Leave',
        is_read: false
      });
    } catch (notifyErr) {
      console.error('Notification error (approve):', notifyErr);
    }
    
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
    
    // Management can reject any leave (Manager or Employee)
    if (userRole === 'Management') {
      // proceed
    } else if (userRole === 'Manager') {
      // Manager can only reject Employee leaves
      if (applicantRole !== 'Employee') {
        return res.status(403).json({
          success: false,
          message: 'Manager can only reject leaves of Employees.'
        });
      }
      // proceed
    }
    
    const rejectedLeave = await leaveModel.rejectLeave(leaveId, rejectorId);

    // Notify applicant about rejection
    try {
      const fromDate = leave.from_date;
      const toDate = leave.to_date;
      const fFrom = formatDate(fromDate);
      const fTo = formatDate(toDate);
      let dateText = fFrom;
      if (fTo && fFrom !== fTo) {
        dateText = `${fFrom} to ${fTo}`;
      }
      await notificationModel.createNotification({
        created_by: rejectorId,
        assigned_to: leave.user_id,
        message: `Your leave request change from ${dateText} has been Rejected.`,
        type: 'Leave',
        is_read: false
      });
    } catch (notifyErr) {
      console.error('Notification error (reject):', notifyErr);
    }
    
    res.status(200).json({
      success: true,
      message: 'Leave rejected',
      data: rejectedLeave
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get department colleague leaves (for Employee calendar view)
 * GET /api/leaves/department-leaves
 */
exports.getDepartmentLeaves = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Get user's department
    const user = await userModel.findUserById(userId);
    
    if (!user || !user.department_id) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'User has no department assigned'
      });
    }
    
    const filters = {
      department_id: user.department_id,
      year: req.query.year ? parseInt(req.query.year) : new Date().getFullYear()
    };
    
    // Employee: Only see other Employees in same department
    // Manager: See Employees in same department + Managers from other departments
    const allLeaves = await leaveModel.getAllLeaves(filters);
    
    let filteredLeaves;
    if (userRole === 'Employee') {
      // Employees see only other Employees in their department
      filteredLeaves = allLeaves.filter(leave => leave.user_role === 'Employee');
    } else if (userRole === 'Manager') {
      // Managers see Employees in their department + all other Managers
      filteredLeaves = allLeaves.filter(leave => {
        if (leave.user_role === 'Employee') {
          return leave.department_id === user.department_id;
        }
        if (leave.user_role === 'Manager') {
          return leave.department_id !== user.department_id;
        }
        return false;
      });
    } else {
      // Management sees all
      filteredLeaves = allLeaves;
    }
    
    res.status(200).json({
      success: true,
      data: filteredLeaves,
      message: 'Department leaves fetched successfully'
    });
  } catch (error) {
    next(error);
  }
};

