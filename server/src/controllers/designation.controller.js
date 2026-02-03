const designationModel = require('../models/designation.model');
const { sendSuccess, sendError } = require('../utils/response');

// Get all designations
exports.getAllDesignations = async (req, res) => {
  try {
    const designations = await designationModel.getAllDesignations();
    return sendSuccess(res, designations, 'Designations retrieved successfully');
  } catch (error) {
    console.error('Get all designations error:', error);
    return sendError(res, 'Failed to retrieve designations', 500);
  }
};

// Get designation by ID
exports.getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    const designation = await designationModel.getDesignationById(id);

    if (!designation) {
      return sendError(res, 'Designation not found', 404);
    }

    return sendSuccess(res, designation, 'Designation retrieved successfully');
  } catch (error) {
    console.error('Get designation by ID error:', error);
    return sendError(res, 'Failed to retrieve designation', 500);
  }
};

// Create designation
exports.createDesignation = async (req, res) => {
  try {
    const { designationName, status = 'active' } = req.body;

    // Validate required fields
    if (!designationName || !designationName.trim()) {
      return sendError(res, 'Designation name is required', 400);
    }

    // Check if designation already exists
    const existingDesignation = await designationModel.getDesignationByName(designationName.trim());
    if (existingDesignation) {
      return sendError(res, 'Designation with this name already exists', 400);
    }

    // Create designation
    const newDesignation = await designationModel.createDesignation(designationName.trim(), status);

    return sendSuccess(res, newDesignation, 'Designation created successfully', 201);
  } catch (error) {
    console.error('Create designation error:', error);
    return sendError(res, 'Failed to create designation', 500);
  }
};

// Update designation
exports.updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Check if designation exists
    const existingDesignation = await designationModel.getDesignationById(id);
    if (!existingDesignation) {
      return sendError(res, 'Designation not found', 404);
    }

    // Map camelCase to snake_case for database
    if (req.body.designationName !== undefined) {
      if (!req.body.designationName.trim()) {
        return sendError(res, 'Designation name cannot be empty', 400);
      }

      // Check if new name is already taken by another designation
      const nameExists = await designationModel.getDesignationByName(req.body.designationName.trim());
      if (nameExists && nameExists.id !== parseInt(id)) {
        return sendError(res, 'Designation name already taken', 400);
      }

      updates.designation_name = req.body.designationName.trim();
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

    const updatedDesignation = await designationModel.updateDesignation(id, updates);

    return sendSuccess(res, updatedDesignation, 'Designation updated successfully');
  } catch (error) {
    console.error('Update designation error:', error);
    return sendError(res, 'Failed to update designation', 500);
  }
};

// Delete designation
exports.deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if designation exists
    const existingDesignation = await designationModel.getDesignationById(id);
    if (!existingDesignation) {
      return sendError(res, 'Designation not found', 404);
    }

    // Delete designation
    const deletedDesignation = await designationModel.deleteDesignation(id);

    return sendSuccess(res, deletedDesignation, 'Designation deleted successfully');
  } catch (error) {
    console.error('Delete designation error:', error);
    return sendError(res, 'Failed to delete designation', 500);
  }
};



