const unitModel = require('../models/unit.model');

exports.getAllUnits = async (req, res) => {
  try {
    const units = await unitModel.getAllUnits();
    res.status(200).json({
      success: true,
      message: 'Units retrieved successfully',
      data: units
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve units',
      error: error.message
    });
  }
};