const leaveEntitlementModel = require('../models/leaveEntitlement.model');
const userModel = require('../models/user.model');

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

// Assign leave to a single user
exports.assignLeave = async (req, res) => {
  try {
    const { user_id, year, leave_entitled, leaves_accumulated } = req.body;
    if (!user_id || !year) return res.status(400).json({ error: 'user_id and year required' });
    const result = await leaveEntitlementModel.updateEntitlement(user_id, year, {
      leave_entitled,
      leaves_accumulated
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk assign leave
exports.bulkAssignLeave = async (req, res) => {
  try {
    const { assignments } = req.body; // [{user_id, year, leave_entitled, leaves_accumulated}]
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments array required' });
    const results = await leaveEntitlementModel.bulkUpdateEntitlements(assignments);
    res.json(results);
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



