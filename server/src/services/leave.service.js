const db = require('../config/db');
const leaveModel = require('../models/leave.model');
const entitlementModel = require('../models/leaveEntitlement.model');

const EARNED_LEAVE_TYPES = new Set(['earned leave']);
const LWP_LEAVE_TYPES = new Set(['leave without pay']);
const DUTY_LEAVE_TYPES = new Set(['duty leave']);
const HALF_DAY_DURATIONS = new Set(['Morning Half', 'Afternoon Half']);
// Only these statuses hold days against the Earned Leave balance
const BALANCE_HOLDING_STATUSES = new Set(['Pending', 'Approved']);

const isEarnedLeaveType = (leaveType) => {
  const normalized = String(leaveType || '').trim().toLowerCase();
  return EARNED_LEAVE_TYPES.has(normalized);
};

const isLeaveWithoutPayType = (leaveType) => {
  const normalized = String(leaveType || '').trim().toLowerCase();
  return LWP_LEAVE_TYPES.has(normalized);
};

const isDutyLeaveType = (leaveType) => {
  const normalized = String(leaveType || '').trim().toLowerCase();
  return DUTY_LEAVE_TYPES.has(normalized);
};

/**
 * Normalise a date to YYYY-MM-DD.
 * pg returns DATE columns as Date objects at local midnight, so local components are used.
 */
const toDateOnly = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return value;
};

// Leave days are charged to the calendar year of the leave's start date
const yearOfDate = (value) => parseInt(String(toDateOnly(value)).slice(0, 4), 10);

/** Days a leave currently holds against the Earned Leave balance. */
const earnedDaysHeld = (leave) => {
  if (!isEarnedLeaveType(leave.leave_type)) return 0;
  if (!BALANCE_HOLDING_STATUSES.has(leave.status)) return 0;
  const days = parseFloat(leave.credited_days);
  return Number.isNaN(days) ? 0 : days;
};

/**
 * Throw if the requested dates overlap another Pending/Approved leave of the same user.
 * Two half days on the same date are allowed when they are different halves.
 */
const assertNoOverlap = async (executor, userId, fromDate, toDate, leaveDuration, excludeLeaveId = null) => {
  const existing = await leaveModel.findActiveLeavesInRange(userId, fromDate, toDate, excludeLeaveId, executor);

  const conflicting = existing.find((leave) => {
    const sameSingleDay = fromDate === toDate
      && toDateOnly(leave.from_date) === fromDate
      && toDateOnly(leave.to_date) === fromDate;
    const differentHalves = HALF_DAY_DURATIONS.has(leaveDuration)
      && HALF_DAY_DURATIONS.has(leave.leave_duration)
      && leaveDuration !== leave.leave_duration;
    return !(sameSingleDay && differentHalves);
  });

  if (conflicting) {
    const from = toDateOnly(conflicting.from_date);
    const to = toDateOnly(conflicting.to_date);
    const range = from === to ? from : `${from} to ${to}`;
    throw new Error(`Leave dates overlap with an existing ${conflicting.status.toLowerCase()} leave (${range})`);
  }
};

/**
 * Check if user is eligible to apply for leave
 * Based on Rule 1: Only Employee, HOD, and Management roles can apply
 */
exports.checkLeaveEligibility = async (userId, userRole) => {
  // Check if user has Employee, HOD, or Management role
  const canApplyForLeave = ['Employee', 'HOD', 'Management'].includes(userRole);

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
    canApply: canApplyForLeave && isActive,
    isEmployeeRole: canApplyForLeave,
    isActive: isActive,
    currentRole: userRole,
      reason: !canApplyForLeave
        ? 'Only Employee, HOD, and Management roles can apply for leave'
      : !isActive
      ? 'User account is not active'
      : null
  };
};

/**
 * Validate date format and sequence
 * Based on Rule 3: Date Validation
 */
exports.validateLeaveDates = (fromDateInput, toDateInput) => {
  const fromDate = toDateOnly(fromDateInput);
  const toDate = toDateOnly(toDateInput);

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

  return { valid: true, normalizedFromDate: fromDate, normalizedToDate };
};

/**
 * Calculate credited days based on duration type
 * Based on Rule 2: Leave Duration Types
 */
exports.calculateCreditedDays = (fromDate, toDate, leaveDuration) => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const from = new Date(toDateOnly(fromDate));
  const to = new Date(toDateOnly(toDate));

  let normalizedToDate = toDateOnly(toDate);
  let creditedDays = 0;

  if (leaveDuration === 'Morning Half' || leaveDuration === 'Afternoon Half') {
    // Half day leaves must be same day
    normalizedToDate = toDateOnly(fromDate);
    creditedDays = 0.5;
  } else {
    // Full Day: calculate difference (calendar days, inclusive)
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
    const fromDate = dateValidation.normalizedFromDate;
    const leaveDuration = leaveData.leave_duration || 'Full Day';

    // 3. Calculate credited days
    const { creditedDays, normalizedToDate } = exports.calculateCreditedDays(
      fromDate,
      dateValidation.normalizedToDate,
      leaveDuration
    );

    // 4. Reject requests that overlap an existing Pending/Approved leave
    await assertNoOverlap(client, userId, fromDate, normalizedToDate, leaveDuration);

    // 5. Year the leave is charged to
    const year = yearOfDate(fromDate);

    const toDateString = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const addDays = (dateStr, days) => {
      const d = new Date(`${dateStr}T00:00:00`);
      d.setDate(d.getDate() + days);
      return toDateString(d);
    };

    // Management leaves are auto-approved
    const leaveStatus = userRole === 'Management' ? 'Approved' : 'Pending';
    const approvedBy = userRole === 'Management' ? userId : null;

    const createLeaveSegment = async (segment) => {
      return await leaveModel.createLeave({
        user_id: userId,
        from_date: segment.from_date,
        to_date: segment.to_date,
        leave_duration: segment.leave_duration,
        credited_days: segment.credited_days,
        leave_reason: leaveData.leave_reason,
        leave_type: segment.leave_type,
        alternate_person: leaveData.alternate_person,
        additional_alternate: leaveData.additional_alternate,
        available_on_phone: leaveData.available_on_phone !== undefined ? leaveData.available_on_phone : true,
        status: leaveStatus,
        approved_by: approvedBy
      }, client);
    };

    const requestedLeaveType = String(leaveData.leave_type || '').trim();

    if (isDutyLeaveType(requestedLeaveType)) {
      // Duty leave does not use the Earned Leave balance
      const dutyLeaveRecord = await createLeaveSegment({
        from_date: fromDate,
        to_date: normalizedToDate,
        leave_duration: leaveDuration,
        credited_days: creditedDays,
        leave_type: 'Duty Leave'
      });

      await client.query('COMMIT');
      return dutyLeaveRecord;
    }

    // 6. Determine earned/LWP based on balance
    const balanceInfo = await entitlementModel.getLeaveBalance(userId, year, client);
    const availableBalance = parseFloat(balanceInfo.leave_balance || 0);

    // 7. Create leave record(s)
    const isFullDay = leaveDuration === 'Full Day';
    let leaveRecord = null;

    if (!isFullDay) {
      // Half-day leave: no split across multiple records
      const leaveType = availableBalance >= creditedDays ? 'Earned Leave' : 'Leave without pay';
      leaveRecord = await createLeaveSegment({
        from_date: fromDate,
        to_date: normalizedToDate,
        leave_duration: leaveDuration,
        credited_days: creditedDays,
        leave_type: leaveType
      });

      if (isEarnedLeaveType(leaveType)) {
        await entitlementModel.updateLeavesAvailed(userId, year, creditedDays, client);
      }
    } else if (availableBalance >= creditedDays) {
      // All earned leave
      leaveRecord = await createLeaveSegment({
        from_date: fromDate,
        to_date: normalizedToDate,
        leave_duration: leaveDuration,
        credited_days: creditedDays,
        leave_type: 'Earned Leave'
      });

      await entitlementModel.updateLeavesAvailed(userId, year, creditedDays, client);
    } else if (availableBalance <= 0) {
      // All leave without pay
      leaveRecord = await createLeaveSegment({
        from_date: fromDate,
        to_date: normalizedToDate,
        leave_duration: leaveDuration,
        credited_days: creditedDays,
        leave_type: 'Leave without pay'
      });
    } else {
      // Split into two requests (earned leave + LWP), integer full days only
      const earnedLeaveDays = Math.min(Math.floor(availableBalance), Math.floor(creditedDays));
      const leaveWithoutPayDays = creditedDays - earnedLeaveDays;

      const records = [];
      let currentDate = fromDate;

      if (earnedLeaveDays > 0) {
        const earnedLeaveTo = addDays(currentDate, earnedLeaveDays - 1);
        records.push(await createLeaveSegment({
          from_date: currentDate,
          to_date: earnedLeaveTo,
          leave_duration: leaveDuration,
          credited_days: earnedLeaveDays,
          leave_type: 'Earned Leave'
        }));
        currentDate = addDays(earnedLeaveTo, 1);
      }

      if (leaveWithoutPayDays > 0) {
        records.push(await createLeaveSegment({
          from_date: currentDate,
          to_date: normalizedToDate,
          leave_duration: leaveDuration,
          credited_days: leaveWithoutPayDays,
          leave_type: 'Leave without pay'
        }));
      }

      if (earnedLeaveDays > 0) {
        await entitlementModel.updateLeavesAvailed(userId, year, earnedLeaveDays, client);
      }
      leaveRecord = records.length === 1 ? records[0] : { split: true, records };
    }

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
 * Move Earned Leave days held by a leave from its old state to its new state.
 * Rejected/Cancelled leaves hold no days; Pending/Approved Earned Leave holds its credited days.
 */
const rebalanceEarnedLeave = async (client, userId, oldLeave, newLeave) => {
  const oldHeld = earnedDaysHeld(oldLeave);
  const newHeld = earnedDaysHeld(newLeave);
  const oldYear = yearOfDate(oldLeave.from_date);
  const newYear = yearOfDate(newLeave.from_date);

  const ensureBalance = async (year, daysNeeded) => {
    if (daysNeeded <= 0) return;
    const balanceInfo = await entitlementModel.getLeaveBalance(userId, year, client);
    const availableBalance = parseFloat(balanceInfo.leave_balance || 0);
    if (availableBalance < daysNeeded) {
      throw new Error('Insufficient leave balance for update');
    }
  };

  if (oldYear === newYear) {
    const difference = newHeld - oldHeld;
    if (difference === 0) return;
    await ensureBalance(newYear, difference);
    await entitlementModel.updateLeavesAvailed(userId, newYear, difference, client);
    return;
  }

  // The leave moved to another year: return the days to the old year, charge the new one
  if (oldHeld !== 0) {
    await entitlementModel.updateLeavesAvailed(userId, oldYear, -oldHeld, client);
  }
  if (newHeld !== 0) {
    await ensureBalance(newYear, newHeld);
    await entitlementModel.updateLeavesAvailed(userId, newYear, newHeld, client);
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

    // 2. Check permissions (case-insensitive, robust)
    const isOwner = existingLeave.user_id === userId;
    const normalizedRole = (userRole || '').trim().toLowerCase();
    const isHodOrMgmt = ["hod", "management"].includes(normalizedRole);
    const isHr = normalizedRole === 'hr';
    const canManageAnyLeave = isHodOrMgmt || isHr;

    if (!isOwner) {
      // Allow HR, HOD, and Management to edit staff leaves
      if (!canManageAnyLeave) {
        throw new Error('Forbidden: You can only update your own leaves');
      }
      if (normalizedRole === 'hod') {
        // HOD can only update Employee leaves
        const applicantRole = (existingLeave.user_role || '').toLowerCase();
        if (applicantRole !== 'employee') {
          throw new Error('HOD can only update leaves of Employees.');
        }
      }
    }

    const updatedFields = { ...updateData };

    // 3. Recalculate credited days when dates or duration change
    const datesChanged = Boolean(updateData.from_date || updateData.to_date || updateData.leave_duration);
    const newFromDate = toDateOnly(updateData.from_date || existingLeave.from_date);
    let newToDate = toDateOnly(existingLeave.to_date);
    let newCreditedDays = existingLeave.credited_days;
    const newDuration = updateData.leave_duration || existingLeave.leave_duration;

    if (datesChanged) {
      const dateValidation = exports.validateLeaveDates(newFromDate, updateData.to_date || existingLeave.to_date);
      if (!dateValidation.valid) {
        throw new Error(dateValidation.error);
      }
      const { creditedDays, normalizedToDate } = exports.calculateCreditedDays(
        newFromDate,
        dateValidation.normalizedToDate,
        newDuration
      );
      newCreditedDays = creditedDays;
      newToDate = normalizedToDate;
      if (updateData.from_date) updatedFields.from_date = newFromDate;
      updatedFields.to_date = normalizedToDate;
      updatedFields.credited_days = creditedDays;
    }

    const newLeaveState = {
      leave_type: updateData.leave_type || existingLeave.leave_type,
      status: updateData.status || existingLeave.status,
      credited_days: newCreditedDays,
      from_date: newFromDate
    };

    // 4. The updated leave must not overlap another active leave
    if (BALANCE_HOLDING_STATUSES.has(newLeaveState.status)
      && (datesChanged || !BALANCE_HOLDING_STATUSES.has(existingLeave.status))) {
      await assertNoOverlap(client, existingLeave.user_id, newFromDate, newToDate, newDuration, existingLeave.id);
    }

    // 5. Update leave record
    const updatedLeave = await leaveModel.updateLeave(leaveId, updatedFields, client);

    // 6. Keep the owner's Earned Leave balance in step with days, type, year and status
    await rebalanceEarnedLeave(client, existingLeave.user_id, existingLeave, newLeaveState);

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
 * Reject a pending leave and return its Earned Leave days to the applicant's balance
 * @returns {Promise<Object|null>} Updated leave, or null if it was no longer pending
 */
exports.rejectLeave = async (leaveId, rejectorId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE leaves
       SET status = 'Rejected',
           approved_by = $1
       WHERE id = $2 AND status = 'Pending'
       RETURNING *`,
      [rejectorId, leaveId]
    );
    const rejectedLeave = result.rows[0] || null;

    if (rejectedLeave) {
      await rebalanceEarnedLeave(
        client,
        rejectedLeave.user_id,
        { ...rejectedLeave, status: 'Pending' },
        rejectedLeave
      );
    }

    await client.query('COMMIT');
    return rejectedLeave;
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
    const normalizedRole = (userRole || '').trim().toLowerCase();
    const canManageAnyLeave = ['hr', 'hod', 'management'].includes(normalizedRole);

    if (existingLeave.user_id !== userId && !canManageAnyLeave) {
      throw new Error('Forbidden: You can only cancel your own leaves');
    }

    // The leave's owner, which is not necessarily the person cancelling it
    const ownerId = existingLeave.user_id;

    // 3. Return any Earned Leave days the leave still holds (Rejected leaves hold none)
    const creditedDays = parseFloat(existingLeave.credited_days);
    const daysHeld = earnedDaysHeld(existingLeave);

    if (daysHeld > 0) {
      await entitlementModel.updateLeavesAvailed(
        ownerId,
        yearOfDate(existingLeave.from_date),
        -daysHeld,
        client
      );
    }

    // 4. Delete leave
    await leaveModel.deleteLeave(leaveId, client);

    // 5. Delete notifications about this leave (sent to HODs, management and the
    // alternate person, or received by the owner). Notifications don't store a
    // leave_id, so they are matched on the leave's start date, which appears in
    // every leave message either as YYYY-MM-DD (on apply) or as Date#toDateString()
    // (on approve/reject/change). Leave notifications for the owner's other leaves
    // are left alone.
    await client.query('SAVEPOINT notification_cleanup');
    try {
      const isoFrom = toDateOnly(existingLeave.from_date);
      const [yyyy, mm, dd] = String(isoFrom).split('-').map(Number);
      const readableFrom = new Date(yyyy, mm - 1, dd).toDateString();
      await client.query(
        `DELETE FROM notifications
         WHERE LOWER(type) = 'leave'
           AND (created_by = $1 OR assigned_to = $1)
           AND (message LIKE $2 OR message LIKE $3)`,
        [ownerId, `%${isoFrom}%`, `%${readableFrom}%`]
      );
    } catch (notifDelErr) {
      // Keep the cancellation even if this cleanup fails
      await client.query('ROLLBACK TO SAVEPOINT notification_cleanup');
      console.error('Error deleting related notifications on leave cancel:', notifDelErr);
    }

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
