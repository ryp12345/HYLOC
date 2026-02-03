const userRoleModel = require('../models/userRole.model');

exports.getAllUserRoles = async (req, res) => {
  try {
    const userRoles = await userRoleModel.getAllUserRoles();
    res.status(200).json({
      success: true,
      message: 'User roles retrieved successfully',
      data: userRoles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user roles',
      error: error.message
    });
  }
};

exports.getUserRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = await userRoleModel.getUserRoleById(id);
    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: 'User role not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'User role retrieved successfully',
      data: userRole
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user role',
      error: error.message
    });
  }
};

exports.createUserRole = async (req, res) => {
  try {
    const { userId, roleId, status } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Role ID are required'
      });
    }

    const userRole = await userRoleModel.createUserRole(userId, roleId, status || 'active');
    res.status(201).json({
      success: true,
      message: 'User role created successfully',
      data: userRole
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create user role',
      error: error.message
    });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, roleId, status } = req.body;

    if (!userId || !roleId || !status) {
      return res.status(400).json({
        success: false,
        message: 'User ID, Role ID, and Status are required'
      });
    }

    const userRole = await userRoleModel.updateUserRole(id, userId, roleId, status);
    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: 'User role not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: userRole
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
};

exports.deleteUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = await userRoleModel.deleteUserRole(id);
    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: 'User role not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role deleted successfully',
      data: userRole
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user role',
      error: error.message
    });
  }
};

exports.getUserRolesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const userRoles = await userRoleModel.getUserRolesByUserId(userId);
    res.status(200).json({
      success: true,
      message: 'User roles retrieved successfully',
      data: userRoles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user roles',
      error: error.message
    });
  }
};



