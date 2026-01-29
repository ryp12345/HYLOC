const UserModel = require('../models/user.model');
const { comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

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

  // Set default role as 'employee' or check empid for admin
  let userRole = 'employee';
  if (user.empid === 10000 || user.email === 'admin@hyloc.co.in') {
    userRole = 'admin';
  }

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

  const accessToken = generateAccessToken(user.id, user.email, user.role);
  return { accessToken };
};

exports.getUserById = async (userId) => {
  const user = await UserModel.findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};
