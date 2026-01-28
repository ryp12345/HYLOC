const departmentModel = require('../models/department.model');
const { sendSuccess, sendError } = require('../utils/response');

// Get all departments
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await departmentModel.getAllDepartments();
    return sendSuccess(res, departments, 'Departments retrieved successfully');
  } catch (error) {
    console.error('Get all departments error:', error);
    return sendError(res, 'Failed to retrieve departments', 500);
  }
};

// Get department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await departmentModel.getDepartmentById(id);

    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    return sendSuccess(res, department, 'Department retrieved successfully');
  } catch (error) {
    console.error('Get department by ID error:', error);
    return sendError(res, 'Failed to retrieve department', 500);
  }
};

// Create department
exports.createDepartment = async (req, res) => {
  try {
    const { deptName, status = 'active' } = req.body;

    // Validate required fields
    if (!deptName || !deptName.trim()) {
      return sendError(res, 'Department name is required', 400);
    }

    // Check if department already exists
    const existingDept = await departmentModel.getDepartmentByName(deptName.trim());
    if (existingDept) {
      return sendError(res, 'Department with this name already exists', 400);
    }

    // Create department
    const newDepartment = await departmentModel.createDepartment(deptName.trim(), status);

    return sendSuccess(res, newDepartment, 'Department created successfully', 201);
  } catch (error) {
    console.error('Create department error:', error);
    return sendError(res, 'Failed to create department', 500);
  }
};

// Update department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Check if department exists
    const existingDept = await departmentModel.getDepartmentById(id);
    if (!existingDept) {
      return sendError(res, 'Department not found', 404);
    }

    // Map camelCase to snake_case for database
    if (req.body.deptName !== undefined) {
      if (!req.body.deptName.trim()) {
        return sendError(res, 'Department name cannot be empty', 400);
      }

      // Check if new name is already taken by another department
      const nameExists = await departmentModel.getDepartmentByName(req.body.deptName.trim());
      if (nameExists && nameExists.id !== parseInt(id)) {
        return sendError(res, 'Department name already taken', 400);
      }

      updates.dept_name = req.body.deptName.trim();
    }

    if (req.body.status !== undefined) {
      if (!['active', 'inactive'].includes(req.body.status)) {
        return sendError(res, 'Invalid status value', 400);
      }
      updates.status = req.body.status;
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const updatedDepartment = await departmentModel.updateDepartment(id, updates);

    return sendSuccess(res, updatedDepartment, 'Department updated successfully');
  } catch (error) {
    console.error('Update department error:', error);
    return sendError(res, 'Failed to update department', 500);
  }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const existingDept = await departmentModel.getDepartmentById(id);
    if (!existingDept) {
      return sendError(res, 'Department not found', 404);
    }

    // Delete department
    const deletedDepartment = await departmentModel.deleteDepartment(id);

    return sendSuccess(res, deletedDepartment, 'Department deleted successfully');
  } catch (error) {
    console.error('Delete department error:', error);
    return sendError(res, 'Failed to delete department', 500);
  }
};
