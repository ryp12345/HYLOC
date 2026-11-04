const UserModel = require('../models/user.model');
const { comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const db = require('../config/db');
const loginAttemptModel = require('../models/loginAttempt.model');

// Thrown when an account is locked after too many failed logins.
class AccountLockedError extends Error {
  constructor(retryAfterSeconds) {
    super('Account temporarily locked');
    this.code = 'ACCOUNT_LOCKED';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
exports.AccountLockedError = AccountLockedError;

// Thrown when the correct password is given for a deactivated account.
class AccountInactiveError extends Error {
  constructor() {
    super('Account inactive');
    this.code = 'ACCOUNT_INACTIVE';
  }
}
exports.AccountInactiveError = AccountInactiveError;

exports.login = async (empid, password) => {
  // Find user by empid
  const user = await UserModel.findUserByEmpid(empid);
  if (!user) {
    throw new Error('Invalid employee ID or password');
  }

  // Only say the account is inactive once the password is proven correct,
  // so guessing IDs does not reveal which accounts exist or are deactivated.
  if (String(user.status || '').toLowerCase() !== 'active') {
    if (await comparePassword(password, user.password)) {
      throw new AccountInactiveError();
    }
    throw new Error('Invalid employee ID or password');
  }

  const lockSecondsRemaining = await loginAttemptModel.getLockSecondsRemaining(user.id);
  if (lockSecondsRemaining > 0) {
    throw new AccountLockedError(lockSecondsRemaining);
  }

  // Compare passwords
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    const lockedForSeconds = await loginAttemptModel.recordFailure(user.id);
    if (lockedForSeconds > 0) {
      throw new AccountLockedError(lockedForSeconds);
    }
    throw new Error('Invalid employee ID or password');
  }
  await loginAttemptModel.clear(user.id);

  // Get user's primary role from user_roles table
  const roleQuery = `
    SELECT r.role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 AND ur.status = 'active'
    ORDER BY ur.id ASC
    LIMIT 1
  `;
  const roleResult = await db.query(roleQuery, [user.id]);
  
  // Use role from database, fallback to 'Employee' if no role assigned
  const userRole = roleResult.rows.length > 0 ? roleResult.rows[0].role_name : 'Employee';

  //console.log('Login successful for user:', user.empid, 'Role:', userRole);

  const tokenVersion = Number(user.token_version) || 0;
  const accessToken = generateAccessToken(user.id, user.email, userRole, tokenVersion);
  const refreshToken = generateRefreshToken(user.id, tokenVersion);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      empid: user.empid,
      departmentId: user.department_id,
      role: userRole,
      // true → the app must send the user to the Change Password screen;
      // the server blocks every other API until the password is changed
      mustChangePassword: user.must_change_password === true
    },
    accessToken,
    refreshToken
  };
};

exports.getActiveRoles = async (userId) => {
  return UserModel.getActiveRoles(userId);
};

// Determine the token role: prefer an explicitly selected role that is one of
// the user's active roles, otherwise fall back to the primary role.
const resolveTokenRole = async (userId, selectedRole) => {
  if (selectedRole) {
    const activeRoles = await UserModel.getActiveRoles(userId);
    const normalized = String(selectedRole).toLowerCase();
    const match = activeRoles.find((r) => String(r).toLowerCase() === normalized);
    if (match) return match;
  }

  const roleQuery = `
    SELECT r.role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 AND ur.status = 'active'
    ORDER BY ur.id ASC
    LIMIT 1
  `;
  const roleResult = await db.query(roleQuery, [userId]);
  return roleResult.rows.length > 0 ? roleResult.rows[0].role_name : 'Employee';
};

exports.switchRole = async (userId, role) => {
  if (!role) {
    throw new Error('Role is required');
  }

  const activeRoles = await UserModel.getActiveRoles(userId);
  const normalized = String(role).toLowerCase();
  const matched = activeRoles.find((r) => String(r).toLowerCase() === normalized);

  if (!matched) {
    throw new Error('You do not have access to this role');
  }

  const user = await UserModel.findUserById(userId);
  const accessToken = generateAccessToken(userId, user?.email, matched, Number(user?.token_version) || 0);
  return { accessToken, role: matched };
};

exports.refreshAccessToken = async (refreshToken, selectedRole) => {
  const { verifyRefreshToken } = require('../utils/jwt');
  
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const user = await UserModel.findUserById(decoded.userId);
  if (
    !user ||
    String(user.status || '').toLowerCase() !== 'active' ||
    (Number(decoded.tokenVersion) || 0) !== (Number(user.token_version) || 0)
  ) {
    throw new Error('User not found');
  }

  const userRole = await resolveTokenRole(user.id, selectedRole);

  const accessToken = generateAccessToken(user.id, user.email, userRole, Number(user.token_version) || 0);
  return { accessToken };
};

exports.getUserById = async (userId) => {
  const user = await UserModel.findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

exports.changePassword = async (userId, currentPassword, newPassword, currentRole) => {
  // Need access to user's hashed password
  const user = await UserModel.findUserWithPasswordById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  // Covers re-using the temporary password: it is the current password
  if (await comparePassword(newPassword, user.password)) {
    throw new Error('New password must be different from the current password');
  }

  // Changing the password bumps token_version, which ends every other session.
  // Clearing must_change_password lifts the forced-change restriction.
  const updated = await UserModel.updateUser(userId, {
    password: newPassword,
    must_change_password: false
  });

  // Fresh session for the person who just changed it, keeping their current role if still active
  const tokenVersion = Number(updated?.token_version) || 0;
  const role = await resolveTokenRole(userId, currentRole);
  return {
    accessToken: generateAccessToken(userId, user.email, role, tokenVersion),
    refreshToken: generateRefreshToken(userId, tokenVersion),
    role
  };
};
