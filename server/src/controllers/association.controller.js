const associationModel = require('../models/association.model');
const { sendSuccess, sendError } = require('../utils/response');

// Get all associations
exports.getAllAssociations = async (req, res) => {
  try {
    const associations = await associationModel.getAllAssociations();
    return sendSuccess(res, associations, 'Associations retrieved successfully');
  } catch (error) {
    console.error('Get all associations error:', error);
    return sendError(res, 'Failed to retrieve associations', 500);
  }
};

// Get association by ID
exports.getAssociationById = async (req, res) => {
  try {
    const { id } = req.params;
    const association = await associationModel.getAssociationById(id);

    if (!association) {
      return sendError(res, 'Association not found', 404);
    }

    return sendSuccess(res, association, 'Association retrieved successfully');
  } catch (error) {
    console.error('Get association by ID error:', error);
    return sendError(res, 'Failed to retrieve association', 500);
  }
};

// Create association
exports.createAssociation = async (req, res) => {
  try {
    const { associationName, status = 'active' } = req.body;

    // Validate required fields
    if (!associationName || !associationName.trim()) {
      return sendError(res, 'Association name is required', 400);
    }

    // Check if association already exists
    const existingAssociation = await associationModel.getAssociationByName(associationName.trim());
    if (existingAssociation) {
      return sendError(res, 'Association with this name already exists', 400);
    }

    // Create association
    const newAssociation = await associationModel.createAssociation(associationName.trim(), status);

    return sendSuccess(res, newAssociation, 'Association created successfully', 201);
  } catch (error) {
    console.error('Create association error:', error);
    return sendError(res, 'Failed to create association', 500);
  }
};

// Update association
exports.updateAssociation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Check if association exists
    const existingAssociation = await associationModel.getAssociationById(id);
    if (!existingAssociation) {
      return sendError(res, 'Association not found', 404);
    }

    // Map camelCase to snake_case for database
    if (req.body.associationName !== undefined) {
      if (!req.body.associationName.trim()) {
        return sendError(res, 'Association name cannot be empty', 400);
      }

      // Check if new name is already taken by another association
      const nameExists = await associationModel.getAssociationByName(req.body.associationName.trim());
      if (nameExists && nameExists.id !== parseInt(id)) {
        return sendError(res, 'Association name already taken', 400);
      }

      updates.association_name = req.body.associationName.trim();
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

    const updatedAssociation = await associationModel.updateAssociation(id, updates);

    return sendSuccess(res, updatedAssociation, 'Association updated successfully');
  } catch (error) {
    console.error('Update association error:', error);
    return sendError(res, 'Failed to update association', 500);
  }
};

// Delete association
exports.deleteAssociation = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if association exists
    const existingAssociation = await associationModel.getAssociationById(id);
    if (!existingAssociation) {
      return sendError(res, 'Association not found', 404);
    }

    // Delete association
    const deletedAssociation = await associationModel.deleteAssociation(id);

    return sendSuccess(res, deletedAssociation, 'Association deleted successfully');
  } catch (error) {
    console.error('Delete association error:', error);
    return sendError(res, 'Failed to delete association', 500);
  }
};



