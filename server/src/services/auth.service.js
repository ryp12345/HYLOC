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

  console.log('Login successful for user:', user.empid, 'Role:', userRole);

  const accessToken = generateAccessToken(user.id, user.email, userRole);
  const refreshToken = generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      empid: user.empid,
      role: userRole
    },
    accessToken,
    refreshToken
  };
};

exports.refreshAccessToken = async (refreshToken) => {
  const { verifyRefreshToken } = require('../utils/jwt');
  
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const user = await UserModel.findUserById(decoded.userId);
  if (!user) {
    throw new Error('User not found');
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
