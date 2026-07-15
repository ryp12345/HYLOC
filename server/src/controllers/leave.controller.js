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
    const userRole = req.user.role;
    const requesterId = req.user.userId;
    const requestedUserId = Number(req.body.user_id);
    const canApplyForStaff = String(userRole || '').toLowerCase() === 'hr';
    const userId = canApplyForStaff && Number.isInteger(requestedUserId) && requestedUserId > 0
      ? requestedUserId
      : requesterId;

    if (requestedUserId && userId !== requestedUserId && !canApplyForStaff) {
      return res.status(403).json({
        success: false,
        message: 'Only HR can apply leave for staff members'
      });
    }
    
    // Validate required fields 
    if (!req.body.from_date || !req.body.leave_reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_date, leave_reason'
      });
    }

    let effectiveRole = userRole;
    if (canApplyForStaff && userId !== requesterId) {
      const targetUser = await userModel.findUserById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Selected staff member not found'
        });
      }

      const targetRole = await db.query(
        `
          SELECT r.role_name
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1 AND ur.status = 'active'
          ORDER BY ur.id ASC
          LIMIT 1
        `,
        [userId]
      );
      effectiveRole = targetRole.rows[0]?.role_name || 'Employee';
    }
    
    const leaveRecord = await leaveService.applyLeave(userId, req.body, effectiveRole);

    // Send notification to department hods when an Employee applies for leave
    try {
      const normalizedRole = (userRole || '').toLowerCase();
      if (normalizedRole === 'employee') {
        const notificationModel = require('../models/notification.model');
        const applicant = await userModel.findUserById(userId);
        if (applicant && applicant.department_id) {
          const hods = await userModel.getHODByDepartment(applicant.department_id);
          if (hods && hods.length > 0) {
            const applicantName = [applicant.firstname, applicant.lastname].filter(Boolean).join(' ');
            const fromDate = req.body.from_date;
            const toDate = req.body.to_date;
            const leaveType = req.body.leave_type || 'Leave';
            let dateText = fromDate;
            if (toDate && fromDate !== toDate) {
              dateText = `${fromDate} to ${toDate}`;
            }
            // Deduplicate hod IDs in case of duplicate rows
            const uniqueHodIds = Array.from(new Set((hods || []).map(m => m && m.id).filter(Boolean)));
            for (const hodId of uniqueHodIds) {
              await notificationModel.createNotification({
              created_by: userId,
              assigned_to: hodId,
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
      console.error('HOD notification error:', notifyErr);
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

          const mgmtUsers = mgmtResult.rows || [];
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
          const uniqueMgmtIds = Array.from(new Set((mgmtUsers || []).map(m => m && m.id).filter(Boolean)));
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
    
    const userRole = (req.user.role || '').toUpperCase();
    
    // Check if user can view this leave
    // Employee/HOD can only view their own
    if (['EMPLOYEE', 'HOD'].includes(userRole) && leave.user_id !== req.user.userId) {
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
    const isApprover = normalizedRole === 'hod' || normalizedRole === 'management';
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
      const hods = await userModel.getHODByDepartment(applicant?.department_id);
      recipients = hods || [];
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
  * Get all pending leaves (for HOD/Management approval)
 * GET /api/leaves/pending
 */
exports.getPendingLeaves = async (req, res, next) => {
  try {
    const userRole = (req.user.role || '').toUpperCase();
    
    // Only HOD and Management can view pending approvals
    if (!['HOD', 'MANAGEMENT'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only HOD and Management can view pending approvals'
      });
    }
    
    const filters = {};
    
    // Management sees leaves > 2 days only
    if (userRole === 'MANAGEMENT') {
      filters.min_duration = 2;
    }
    
    // HOD sees leaves from their department (if applicable)
    if (userRole === 'HOD' && req.query.department_id) {
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
    const userRole = (req.user.role || '').toUpperCase();
    
    // Only Management, HOD and HR can view all leaves
    if (!['MANAGEMENT', 'HOD', 'HR'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Management, HOD and HR can view all leaves'
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
  * Approve leave (for HOD/Management)
 * POST /api/leaves/:id/approve
 */
exports.approveLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const approverId = req.user.userId;
    const userRole = (req.user.role || '').toUpperCase();
    
    // Only HOD and Management can approve
    if (!['HOD', 'MANAGEMENT'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only HOD and Management can approve leaves'
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

    // Prevent self-approval
    if (leave.user_id === approverId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot approve your own leave request.'
      });
    }

    // Get leave applicant's role (must match the role used when listing leaves:
    // first role by id, defaulting to 'Employee' when no user_roles row exists).
    const roleQuery = `
      SELECT COALESCE(
        (
          SELECT r.role_name
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1
          ORDER BY ur.id ASC
          LIMIT 1
        ), 'Employee'
      ) as role_name
    `;
    const roleResult = await db.query(roleQuery, [leave.user_id]);
    const applicantRole = roleResult.rows[0]?.role_name;
    
    // Management can approve any leave (HOD or Employee)
    if (userRole === 'MANAGEMENT') {
      // proceed
    } else if (userRole === 'HOD') {
      // HOD can only approve Employee leaves
      if ((applicantRole || '').toUpperCase() !== 'EMPLOYEE') {
        return res.status(403).json({
          success: false,
          message: 'HOD can only approve leaves of Employees.'
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
  * Reject leave (for HOD/Management)
 * POST /api/leaves/:id/reject
 */
exports.rejectLeave = async (req, res, next) => {
  try {
    const leaveId = parseInt(req.params.id);
    const rejectorId = req.user.userId;
    const userRole = (req.user.role || '').toUpperCase();
    
    // Only HOD and Management can reject
    if (!['HOD', 'MANAGEMENT'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only HOD and Management can reject leaves'
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

    // Prevent self-rejection
    if (leave.user_id === rejectorId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot reject your own leave request.'
      });
    }

    // Get leave applicant's role (consistent with listing: first role by id, default Employee)
    const roleQuery = `
      SELECT COALESCE(
        (
          SELECT r.role_name
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1
          ORDER BY ur.id ASC
          LIMIT 1
        ), 'Employee'
      ) as role_name
    `;
    const roleResult = await db.query(roleQuery, [leave.user_id]);
    const applicantRole = roleResult.rows[0]?.role_name;
    
    // Management can reject any leave (HOD or Employee)
    if (userRole === 'MANAGEMENT') {
      // proceed
    } else if (userRole === 'HOD') {
      // HOD can only reject Employee leaves
      if ((applicantRole || '').toUpperCase() !== 'EMPLOYEE') {
        return res.status(403).json({
          success: false,
          message: 'HOD can only reject leaves of Employees.'
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
    const userRole = (req.user.role || '').toUpperCase();
    
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
    // HOD: See Employees in their department + HODs from other departments
    const allLeaves = await leaveModel.getAllLeaves(filters);
    
    let filteredLeaves;
    if (userRole === 'EMPLOYEE') {
      // Employees see only other Employees in their department
      filteredLeaves = allLeaves.filter(leave => (leave.user_role || '').toUpperCase() === 'EMPLOYEE');
    } else if (userRole === 'HOD') {
      // HODs see Employees in their department + all other HODs
      filteredLeaves = allLeaves.filter(leave => {
        const role = (leave.user_role || '').toUpperCase();
        if (role === 'EMPLOYEE') {
          return leave.department_id === user.department_id;
        }
        if (role === 'HOD') {
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

