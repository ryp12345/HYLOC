const kpiDataValueModel = require('../models/kpi-data-value.model');

exports.getAllKPIDataValues = async (req, res) => {
  try {
    const dataValues = await kpiDataValueModel.getAllKPIDataValues();
    res.status(200).json({
      success: true,
      message: 'KPI data values retrieved successfully',
      data: dataValues
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI data values',
      error: error.message
    });
  }
};

exports.getKPIDataValueById = async (req, res) => {
  try {
    const { id } = req.params;
    const dataValue = await kpiDataValueModel.getKPIDataValueById(id);

    if (!dataValue) {
      return res.status(404).json({
        success: false,
        message: 'KPI data value not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI data value retrieved successfully',
      data: dataValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI data value',
      error: error.message
    });
  }
};

exports.getMonthlyDataByKPIValue = async (req, res) => {
  try {
    const { kpiValueId } = req.params;
    const { year } = req.query;

    const data = await kpiDataValueModel.getMonthlyDataByKPIValue(
      kpiValueId,
      year ? parseInt(year) : null
    );

    res.status(200).json({
      success: true,
      message: 'Monthly data retrieved successfully',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly data',
      error: error.message
    });
  }
};

exports.getMultipleKPIValuesData = async (req, res) => {
  try {
    const { kpiValueIds, year } = req.body;

    if (!Array.isArray(kpiValueIds) || kpiValueIds.length === 0 || !year) {
      return res.status(400).json({
        success: false,
        message: 'kpiValueIds (array) and year are required'
      });
    }

    const data = await kpiDataValueModel.getMultipleKPIValuesData(
      kpiValueIds,
      parseInt(year)
    );

    res.status(200).json({
      success: true,
      message: 'Data for multiple KPI values retrieved successfully',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve data for multiple KPI values',
      error: error.message
    });
  }
};

exports.createKPIDataValue = async (req, res) => {
  try {
    const { kpi_value_id, value, value_type, month, year } = req.body;

    if (!kpi_value_id || value === undefined || !value_type || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'kpi_value_id, value, value_type, month, and year are required'
      });
    }

    const dataValue = await kpiDataValueModel.createKPIDataValue(
      kpi_value_id,
      value,
      value_type,
      month,
      year
    );

    res.status(201).json({
      success: true,
      message: 'KPI data value created successfully',
      data: dataValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create KPI data value',
      error: error.message
    });
  }
};

exports.updateKPIDataValue = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, value_type } = req.body;

    const dataValue = await kpiDataValueModel.updateKPIDataValue(
      id,
      value,
      value_type
    );

    if (!dataValue) {
      return res.status(404).json({
        success: false,
        message: 'KPI data value not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI data value updated successfully',
      data: dataValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update KPI data value',
      error: error.message
    });
  }
};

exports.deleteKPIDataValue = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await kpiDataValueModel.deleteKPIDataValue(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'KPI data value not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI data value deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete KPI data value',
      error: error.message
    });
  }
};
