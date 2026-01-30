
const db = require('../config/db');
const leaveModel = require('../models/leave.model');
const entitlementModel = require('../models/leaveEntitlement.model');

/**
 * Check if user is eligible to apply for leave
 * Based on Rule 1: Only Employee and Manager roles can apply
 */
exports.checkLeaveEligibility = async (userId, userRole) => {
  // Check if user has Employee or Manager role
  const isEmployeeOrManager = ['Employee', 'Manager'].includes(userRole);
  
  // Get user status from database
  const userQuery = 'SELECT status FROM users WHERE id = $1';
  const result = await db.query(userQuery, [userId]);
  
  if (!result.rows.length) {
    return {
      canApply: false,
      reason: 'User not found',
      isEmployeeRole: false,
      isActive: false,
      currentRole: userRole
    };
  }
  
  const user = result.rows[0];
  const isActive = user.status === 'active';
  
  return {
    canApply: isEmployeeOrManager && isActive,
    isEmployeeRole: isEmployeeOrManager,
    isActive: isActive,
    currentRole: userRole,
    reason: !isEmployeeOrManager 
      ? 'Only Employee and Manager roles can apply for leave'
      : !isActive 
      ? 'User account is not active'
      : null
  };
};

/**
 * Validate date format and sequence
 * Based on Rule 3: Date Validation
 */
exports.validateLeaveDates = (fromDate, toDate) => {
  // Check date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!fromDate) {
    return { valid: false, error: 'from_date is required' };
  }
  
  if (!dateRegex.test(fromDate)) {
    return { valid: false, error: 'Invalid from_date format. Expect YYYY-MM-DD' };
  }
  
  const normalizedToDate = toDate || fromDate;
  
  if (!dateRegex.test(normalizedToDate)) {
    return { valid: false, error: 'Invalid to_date format. Expect YYYY-MM-DD' };
  }
  
  const from = new Date(fromDate);
  const to = new Date(normalizedToDate);
  
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return { valid: false, error: 'Invalid date values' };
  }
  
  if (to < from) {
    return { valid: false, error: 'to_date cannot be earlier than from_date' };
  }
  
  return { valid: true, normalizedToDate };
};

/**
 * Calculate credited days based on duration type
 * Based on Rule 2: Leave Duration Types
 */
exports.calculateCreditedDays = (fromDate, toDate, leaveDuration) => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  let normalizedToDate = toDate;
  let creditedDays = 0;
  
  if (leaveDuration === 'Morning Half' || leaveDuration === 'Afternoon Half') {
    // Half day leaves must be same day
    normalizedToDate = fromDate;
    creditedDays = 0.5;
  } else {
    // Full Day: calculate difference
    const daysDiff = Math.round((to - from) / MS_PER_DAY) + 1;
    creditedDays = Math.round(daysDiff * 10) / 10;
  }
  
  return { creditedDays, normalizedToDate };
};

/**
 * Apply for leave with full validation and balance update
 * Based on Rules 1-4, 9
 */
exports.applyLeave = async (userId, leaveData, userRole) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Check eligibility
    const eligibility = await exports.checkLeaveEligibility(userId, userRole);
    if (!eligibility.canApply) {
      throw new Error(eligibility.reason || 'Not eligible to apply for leave');
    }
    
    // 2. Validate dates
    const dateValidation = exports.validateLeaveDates(leaveData.from_date, leaveData.to_date);
    if (!dateValidation.valid) {
      throw new Error(dateValidation.error);
    }
    
    // 3. Calculate credited days
    const { creditedDays, normalizedToDate } = exports.calculateCreditedDays(
      leaveData.from_date,
      dateValidation.normalizedToDate,
      leaveData.leave_duration || 'Full Day'
    );
    
    // 4. Get current year
    const year = new Date(leaveData.from_date).getFullYear();
    
    // 5. Create leave record
    const leaveRecord = await leaveModel.createLeave({
      user_id: userId,
      from_date: leaveData.from_date,
      to_date: normalizedToDate,
      leave_duration: leaveData.leave_duration || 'Full Day',
      credited_days: creditedDays,
      leave_reason: leaveData.leave_reason,
      leave_type: leaveData.leave_type || 'Paid',
      alternate_person: leaveData.alternate_person,
      additional_alternate: leaveData.additional_alternate,
      available_on_phone: leaveData.available_on_phone !== undefined ? leaveData.available_on_phone : true
    });
    
    // 6. Update leaves_availed in entitlement
    await entitlementModel.updateLeavesAvailed(userId, year, creditedDays, client);
    
    await client.query('COMMIT');
    
    return leaveRecord;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update leave with balance adjustment (allowing all statuses)
 */
exports.updatePendingLeave = async (leaveId, userId, updateData, userRole) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get existing leave
    const existingLeave = await leaveModel.getLeaveById(leaveId);
    
    if (!existingLeave) {
      throw new Error('Leave not found');
    }
    
    // 2. Check ownership
    if (existingLeave.user_id !== userId) {
      throw new Error('Forbidden: You can only update your own leaves');
    }
    
    // 3. Skip status check - allow editing of any status
    
    // 4. If dates or duration changed, recalculate credited_days
    let newCreditedDays = existingLeave.credited_days;
    let updatedFields = { ...updateData };
    
    if (updateData.from_date || updateData.to_date || updateData.leave_duration) {
      const fromDate = updateData.from_date || existingLeave.from_date;
      const toDate = updateData.to_date || existingLeave.to_date;
      const duration = updateData.leave_duration || existingLeave.leave_duration;
      
      // Validate new dates
      const dateValidation = exports.validateLeaveDates(fromDate, toDate);
      if (!dateValidation.valid) {
        throw new Error(dateValidation.error);
      }
      
      // Calculate new credited days
      const { creditedDays, normalizedToDate } = exports.calculateCreditedDays(
        fromDate,
        dateValidation.normalizedToDate,
        duration
      );
      
      newCreditedDays = creditedDays;
      updatedFields.to_date = normalizedToDate;
      updatedFields.credited_days = creditedDays;
    }
    
    // 5. Update leave record
    const updatedLeave = await leaveModel.updateLeave(leaveId, updatedFields);
    
    // 6. Adjust balance if credited_days changed
    const oldCreditedDays = parseFloat(existingLeave.credited_days);
    const difference = newCreditedDays - oldCreditedDays;
    
    if (difference !== 0) {
      const year = new Date(existingLeave.from_date).getFullYear();
      await entitlementModel.updateLeavesAvailed(userId, year, difference, client);
    }
    
    await client.query('COMMIT');
    
    return updatedLeave;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancel leave with partial cancellation support
 * Based on Rule 7, 8: Can Only Delete Pending Leaves, Partial Cancellation
 */
exports.cancelLeave = async (leaveId, userId, userRole) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get existing leave
    const existingLeave = await leaveModel.getLeaveById(leaveId);
    
    if (!existingLeave) {
      throw new Error('Leave not found');
    }
    
    // 2. Check ownership
    if (existingLeave.user_id !== userId) {
      throw new Error('Forbidden: You can only cancel your own leaves');
    }
    
    // 3. Restore full balance for all statuses
    const creditedDays = parseFloat(existingLeave.credited_days);
    const fromDate = new Date(existingLeave.from_date);
    const year = fromDate.getFullYear();
    
    await entitlementModel.updateLeavesAvailed(
      userId,
      year,
      -creditedDays,
      client
    );
    
    // 4. Delete leave
    await leaveModel.deleteLeave(leaveId);
    
    await client.query('COMMIT');
    
    return {
      type: 'full',
      message: 'Leave cancelled successfully',
      cancelledDays: creditedDays,
      retainedDays: 0
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get leave balance for user
 */
exports.getLeaveBalance = async (userId, year = null) => {
  const targetYear = year || new Date().getFullYear();
  return await entitlementModel.getLeaveBalance(userId, targetYear);
};
