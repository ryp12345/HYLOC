const leaveEntitlementModel = require('../models/leaveEntitlement.model');
const employeeMonthlyWorkingDaysModel = require('../models/employeeMonthlyWorkingDays.model');
const userModel = require('../models/user.model');

/**
 * Compute leave_entitled from NoOFDays (working days) and joining date rules:
 *  - Joining year         → 0  (regardless of NoOFDays)
 *  - Any year after       → min(ceil(noOfDays / 20), 15)
 *
 * @param {number} noOfDays   - Working days entered in the NoOFDays column
 * @param {Date}   joiningDate - Employee joining date (created_at)
 * @param {number} targetYear  - The year entitlements are being set for
 */
function computeEntitledDays(noOfDays, joiningDate, targetYear) {
  const joiningYear = joiningDate.getFullYear();
  if (targetYear <= joiningYear) return 0.0;
  // For all years after joining: apply formula on the admin-supplied working days
  return Math.min(Math.ceil(noOfDays / 20), 15);
}

function getValidatedMonth(monthValue) {
  const month = Number(monthValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return month;
}

// List entitlements for a year
exports.listEntitlements = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });
    const entitlements = await leaveEntitlementModel.getAllBalances(Number(year));
    res.json(entitlements);
  } catch (err) {
    console.error('Error in listEntitlements:', err);
    res.status(500).json({ error: err.message });
  }
};

// List users with assignment status for a year
exports.listStaffWithStatus = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });
    const users = await userModel.getAllUsers();
    const entitlements = await leaveEntitlementModel.getAllBalances(Number(year));
    const entitlementMap = new Map(entitlements.map(e => [e.user_id, e]));
    const staff = users.map(u => ({
      ...u,
      entitlement: entitlementMap.get(u.id) || null
    }));
    res.json(staff);
  } catch (err) {
    console.error('Error in listStaffWithStatus:', err);
    res.status(500).json({ error: err.message });
  }
};

// List staff with monthly working-day status for the current year and selected month
exports.listStaffWithMonthlyWorkingDaysStatus = async (req, res) => {
  try {
    const month = getValidatedMonth(req.query.month);
    if (!month) return res.status(400).json({ error: 'Valid month is required' });

    const year = new Date().getFullYear();
    const users = await userModel.getAllUsers();
    const monthlyWorkingDays = await employeeMonthlyWorkingDaysModel.getMonthlyWorkingDays(year, month);
    const monthlyMap = new Map(monthlyWorkingDays.map((record) => [record.user_id, record]));

    const staff = users.map((user) => ({
      ...user,
      monthly_working_days: monthlyMap.get(user.id) || null
    }));

    res.json({ year, month, staff });
  } catch (err) {
    console.error('Error in listStaffWithMonthlyWorkingDaysStatus:', err);
    res.status(500).json({ error: err.message });
  }
};

// Import monthly working days for the current year and selected month
exports.importMonthlyWorkingDays = async (req, res) => {
  try {
    const month = getValidatedMonth(req.body.month);
    const { assignments } = req.body;

    if (!month) return res.status(400).json({ error: 'Valid month is required' });
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments array required' });

    const year = new Date().getFullYear();
    const allUsers = await userModel.getAllUsers();
    const userMap = new Map(allUsers.map((user) => [user.id, user]));
    const userMapByEmpid = new Map(
      allUsers
        .filter(u => u.empid !== null && u.empid !== undefined)
        .map(u => [String(u.empid).trim().toLowerCase(), u])
    );
    const dedupedEntries = new Map();

    for (const assignment of assignments) {
      // Resolve user by numeric user_id OR by empid fallback (string or numeric)
      let user = null;
      const possibleUserId = Number(assignment.user_id);
      if (Number.isFinite(possibleUserId) && userMap.get(possibleUserId)) {
        user = userMap.get(possibleUserId);
      } else {
        // try empid fields (empid, employee_id, emp_id) or string user_id
        const empRef = assignment.empid ?? assignment.employee_id ?? assignment.emp_id ?? assignment.user_id;
        if (empRef !== null && empRef !== undefined) {
          const key = String(empRef).trim().toLowerCase();
          user = userMapByEmpid.get(key) || null;
        }
      }

      const noOfDays = Number(assignment.no_of_days ?? assignment.noOfDays ?? assignment.noOfDays);
      if (!user || !Number.isFinite(noOfDays) || noOfDays < 0) {
        continue;
      }

      const resolvedUserId = user.id;
      dedupedEntries.set(resolvedUserId, {
        user_id: resolvedUserId,
        empid: user ? user.empid : null,
        year,
        month,
        no_of_days: noOfDays
      });
    }

    const entries = Array.from(dedupedEntries.values());
    const records = entries.length > 0
      ? await employeeMonthlyWorkingDaysModel.bulkUpsertMonthlyWorkingDays(entries)
      : [];

    res.json({ success: true, year, month, updated: records.length, records });
  } catch (err) {
    console.error('Error in importMonthlyWorkingDays:', err);
    res.status(500).json({ error: err.message });
  }
};

// Import leave entitlements from uploaded rows
exports.importEntitlements = async (req, res) => {
  try {
    const { assignments } = req.body; // [{user_id, year, leave_entitled (= NoOFDays = working days)}]
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments array required' });

    // Fetch all users once to resolve joining dates
    const allUsers = await userModel.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const results = [];

    for (const assignment of assignments) {
      const userId = Number(assignment.user_id);
      const year = Number(assignment.year);
      // leave_entitled from the client payload carries the NoOFDays (working days) value
      const noOfDays = Number(assignment.leave_entitled ?? 0);

      if (!Number.isFinite(userId) || !Number.isFinite(year) || !Number.isFinite(noOfDays) || noOfDays < 0) continue;

      const user = userMap.get(userId);
      if (!user || !user.created_at) continue;

      // Apply business rules: formula uses noOfDays as working days, bounded by joining year logic
      const joiningDate = new Date(user.created_at);
      const leaveEntitled = computeEntitledDays(noOfDays, joiningDate, year);

      // Compute carryover from previous year balance (mirrors scheduler behaviour)
      const prevBalance = await leaveEntitlementModel.getEntitlementByUserAndYear(userId, year - 1);
      let leavesAccumulated = 0;
      if (prevBalance) {
        const bal = parseFloat(prevBalance.leave_entitled) + parseFloat(prevBalance.leaves_accumulated) - parseFloat(prevBalance.leaves_availed);
        leavesAccumulated = Math.max(bal, 0);
      }

      await leaveEntitlementModel.createOrGetEntitlement(userId, year, leaveEntitled);
      const updated = await leaveEntitlementModel.updateEntitlement(userId, year, {
        leave_entitled: leaveEntitled,
        leaves_accumulated: leavesAccumulated
      });

      if (updated) {
        results.push(updated);
      }
    }

    res.json({ success: true, updated: results.length, records: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update entitlement
exports.updateEntitlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { leave_entitled, leaves_accumulated, leaves_availed } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    // Find by id, get user_id and year
    const entitlement = await leaveEntitlementModel.getEntitlementById(id);
    if (!entitlement) return res.status(404).json({ error: 'Entitlement not found' });
    const updated = await leaveEntitlementModel.updateEntitlement(entitlement.user_id, entitlement.year, {
      leave_entitled,
      leaves_accumulated,
      leaves_availed
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete entitlement
exports.deleteEntitlement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });
    // Find by id, get user_id and year
    const entitlement = await leaveEntitlementModel.getEntitlementById(id);
    if (!entitlement) return res.status(404).json({ error: 'Entitlement not found' });
    const deleted = await leaveEntitlementModel.deleteEntitlement(entitlement.user_id, entitlement.year);
    res.json({ success: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



