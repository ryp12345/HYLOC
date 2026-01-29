const roleModel = require('../models/role.model');
const { sendSuccess, sendError } = require('../utils/response');

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await roleModel.getAllRoles();
    return sendSuccess(res, roles, 'Roles retrieved successfully');
  } catch (error) {
    console.error('Get all roles error:', error);
    return sendError(res, 'Failed to retrieve roles', 500);
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await roleModel.getRoleById(id);

    if (!role) {
      return sendError(res, 'Role not found', 404);
    }

    return sendSuccess(res, role, 'Role retrieved successfully');
  } catch (error) {
    console.error('Get role by ID error:', error);
    return sendError(res, 'Failed to retrieve role', 500);
  }
};

// Create role
exports.createRole = async (req, res) => {
  try {
    const { roleName } = req.body;

    // Validate required fields
    if (!roleName || !roleName.trim()) {
      return sendError(res, 'Role name is required', 400);
    }

    // Check if role already exists
    const existingRole = await roleModel.getRoleByName(roleName.trim());
    if (existingRole) {
      return sendError(res, 'Role with this name already exists', 400);
    }

    // Create role
    const newRole = await roleModel.createRole(roleName.trim());

    return sendSuccess(res, newRole, 'Role created successfully', 201);
  } catch (error) {
    console.error('Create role error:', error);
    return sendError(res, 'Failed to create role', 500);
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName } = req.body;

    // Check if role exists
    const existingRole = await roleModel.getRoleById(id);
    if (!existingRole) {
      return sendError(res, 'Role not found', 404);
    }

    // Validate name if provided
    if (roleName !== undefined) {
      if (!roleName.trim()) {
        return sendError(res, 'Role name cannot be empty', 400);
      }

      // Check if new name is already taken by another role
      const nameExists = await roleModel.getRoleByName(roleName.trim());
      if (nameExists && nameExists.id !== parseInt(id)) {
        return sendError(res, 'Role name already taken', 400);
      }

      // Update role
      const updatedRole = await roleModel.updateRole(id, roleName.trim());
      return sendSuccess(res, updatedRole, 'Role updated successfully');
    }

    return sendSuccess(res, existingRole, 'No changes made');
  } catch (error) {
    console.error('Update role error:', error);
    return sendError(res, 'Failed to update role', 500);
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const role = await roleModel.getRoleById(id);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }

    // Delete role
    await roleModel.deleteRole(id);

    return sendSuccess(res, null, 'Role deleted successfully');
  } catch (error) {
    console.error('Delete role error:', error);
    return sendError(res, 'Failed to delete role', 500);
  }
};
