const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/hash');
const { successResponse, errorResponse } = require('../utils/response');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    return successResponse(res, users, 'Users retrieved successfully');
  } catch (error) {
    console.error('Get all users error:', error);
    return errorResponse(res, 'Failed to retrieve users', 500);
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    return successResponse(res, user, 'User retrieved successfully');
  } catch (error) {
    console.error('Get user by ID error:', error);
    return errorResponse(res, 'Failed to retrieve user', 500);
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'user' } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return errorResponse(res, 'Email, password, first name, and last name are required', 400);
    }

    // Check if user already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 400);
    }

    // Create user
    const newUser = await userModel.createUser(email, password, firstName, lastName, role);
    
    return successResponse(res, newUser, 'User created successfully', 201);
  } catch (error) {
    console.error('Create user error:', error);
    return errorResponse(res, 'Failed to create user', 500);
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Check if user exists
    const existingUser = await userModel.findUserById(id);
    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // Map camelCase to snake_case for database
    if (req.body.firstName !== undefined) updates.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) updates.last_name = req.body.lastName;
    if (req.body.email !== undefined) {
      // Check if email is already taken by another user
      const emailExists = await userModel.findUserByEmail(req.body.email);
      if (emailExists && emailExists.id !== parseInt(id)) {
        return errorResponse(res, 'Email already taken by another user', 400);
      }
      updates.email = req.body.email;
    }
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    // Hash password if provided
    if (req.body.password) {
      updates.password = await hashPassword(req.body.password);
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'No fields to update', 400);
    }

    const updatedUser = await userModel.updateUser(id, updates);
    
    return successResponse(res, updatedUser, 'User updated successfully');
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse(res, 'Failed to update user', 500);
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await userModel.findUserById(id);
    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // Prevent deleting yourself
    if (req.user.id === parseInt(id)) {
      return errorResponse(res, 'You cannot delete your own account', 400);
    }

    await userModel.deleteUser(id);
    
    return successResponse(res, null, 'User deleted successfully');
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse(res, 'Failed to delete user', 500);
  }
};

// Get current user profile
exports.getMyProfile = async (req, res) => {
  try {
    const user = await userModel.findUserById(req.user.id);
    return successResponse(res, user, 'Profile retrieved successfully');
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 'Failed to retrieve profile', 500);
  }
};
