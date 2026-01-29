const pillerModel = require('../models/piller.model');

exports.getAllPillers = async (req, res) => {
  try {
    const pillers = await pillerModel.getAllPillers();
    res.status(200).json({
      success: true,
      message: 'Pillers retrieved successfully',
      data: pillers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pillers',
      error: error.message
    });
  }
};

exports.getPillerById = async (req, res) => {
  try {
    const { id } = req.params;
    const piller = await pillerModel.getPillerById(id);
    if (!piller) {
      return res.status(404).json({
        success: false,
        message: 'Piller not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Piller retrieved successfully',
      data: piller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve piller',
      error: error.message
    });
  }
};

exports.createPiller = async (req, res) => {
  try {
    const { pillerName, shortName } = req.body;

    if (!pillerName || !shortName) {
      return res.status(400).json({
        success: false,
        message: 'Piller name and short name are required'
      });
    }

    const existingPiller = await pillerModel.getPillerByName(pillerName);
    if (existingPiller) {
      return res.status(400).json({
        success: false,
        message: 'Piller already exists'
      });
    }

    const piller = await pillerModel.createPiller(pillerName, shortName);
    res.status(201).json({
      success: true,
      message: 'Piller created successfully',
      data: piller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create piller',
      error: error.message
    });
  }
};

exports.updatePiller = async (req, res) => {
  try {
    const { id } = req.params;
    const { pillerName, shortName } = req.body;

    if (!pillerName || !shortName) {
      return res.status(400).json({
        success: false,
        message: 'Piller name and short name are required'
      });
    }

    const piller = await pillerModel.updatePiller(id, pillerName, shortName);
    if (!piller) {
      return res.status(404).json({
        success: false,
        message: 'Piller not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Piller updated successfully',
      data: piller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update piller',
      error: error.message
    });
  }
};

exports.deletePiller = async (req, res) => {
  try {
    const { id } = req.params;
    const piller = await pillerModel.deletePiller(id);
    if (!piller) {
      return res.status(404).json({
        success: false,
        message: 'Piller not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Piller deleted successfully',
      data: piller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete piller',
      error: error.message
    });
  }
};
