const UserModel = require('../models/user.model');
const { comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const db = require('../config/db');

exports.register = async (email, password, firstName, lastName) => {
  // Check if user already exists
  const existingUser = await UserModel.findUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Create user
  const user = await UserModel.createUser(email, password, firstName, lastName, 'employee');
  
  // Generate tokens (set default role if not present)
  const userRole = user.role || 'employee';
  const accessToken = generateAccessToken(user.id, user.email, userRole);
  const refreshToken = generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: userRole
    },
    accessToken,
    refreshToken
  };
};

exports.login = async (empid, password) => {
  // Find user by empid
  const user = await UserModel.findUserByEmpid(empid);
  if (!user) {
    throw new Error('Invalid employee ID or password');
  }

  // Compare passwords
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid employee ID or password');
  }

  // Get user's primary role from user_roles table
  const roleQuery = `
    SELECT r.role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1
    ORDER BY ur.id ASC
    LIMIT 1
  `;
  const roleResult = await db.query(roleQuery, [user.id]);
  
  // Use role from database, fallback to 'Employee' if no role assigned
  const userRole = roleResult.rows.length > 0 ? roleResult.rows[0].role_name : 'Employee';

  //console.log('Login successful for user:', user.empid, 'Role:', userRole);

  const accessToken = generateAccessToken(user.id, user.email, userRole);
  const refreshToken = generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      empid: user.empid,
      departmentId: user.department_id,
      role: userRole
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
    WHERE ur.user_id = $1
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
  const accessToken = generateAccessToken(userId, user?.email, matched);
  return { accessToken, role: matched };
};

exports.refreshAccessToken = async (refreshToken, selectedRole) => {
  const { verifyRefreshToken } = require('../utils/jwt');
  
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const user = await UserModel.findUserById(decoded.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const userRole = await resolveTokenRole(user.id, selectedRole);

  const accessToken = generateAccessToken(user.id, user.email, userRole);
  return { accessToken };
};

exports.getUserById = async (userId) => {
  const user = await UserModel.findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

exports.changePassword = async (userId, currentPassword, newPassword) => {
  // Need access to user's hashed password
  const user = await UserModel.findUserWithPasswordById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  await UserModel.updateUser(userId, { password: newPassword });
  return true;
};
