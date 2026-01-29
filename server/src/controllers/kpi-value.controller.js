const kpiValueModel = require('../models/kpi-value.model');

exports.getAllKPIValues = async (req, res) => {
  try {
    const { kpi_id } = req.query;
    
    if (kpi_id) {
      const values = await kpiValueModel.getKPIValuesByKPI(kpi_id);
      return res.status(200).json({
        success: true,
        message: 'KPI values retrieved successfully',
        data: values
      });
    }
    
    const values = await kpiValueModel.getAllKPIValues();
    res.status(200).json({
      success: true,
      message: 'KPI values retrieved successfully',
      data: values
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI values',
      error: error.message
    });
  }
};

exports.getKPIValuesByKPI = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const values = await kpiValueModel.getKPIValuesByKPI(kpiId);
    
    res.status(200).json({
      success: true,
      message: 'KPI values retrieved successfully',
      data: values
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI values',
      error: error.message
    });
  }
};

exports.getKPIValueById = async (req, res) => {
  try {
    const { id } = req.params;
    const value = await kpiValueModel.getKPIValueById(id);
    
    if (!value) {
      return res.status(404).json({
        success: false,
        message: 'KPI value not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'KPI value retrieved successfully',
      data: value
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI value',
      error: error.message
    });
  }
};

exports.createKPIValue = async (req, res) => {
  try {
    const {
      data,
      kpi_id,
      data_operator,
      target_required,
      uom,
      kpi_type,
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    } = req.body;

    if (!kpi_id || !data) {
      return res.status(400).json({
        success: false,
        message: 'kpi_id and data are required'
      });
    }

    const kpiValue = await kpiValueModel.createKPIValue({
      data,
      kpi_id,
      data_operator,
      target_required,
      uom,
      kpi_type,
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    });

    res.status(201).json({
      success: true,
      message: 'KPI value created successfully',
      data: kpiValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create KPI value',
      error: error.message
    });
  }
};

exports.updateKPIValue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      data,
      kpi_id,
      data_operator,
      target_required,
      uom,
      kpi_type,
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    } = req.body;

    const kpiValue = await kpiValueModel.updateKPIValue(id, {
      data,
      kpi_id,
      data_operator,
      target_required,
      uom,
      kpi_type,
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    });

    if (!kpiValue) {
      return res.status(404).json({
        success: false,
        message: 'KPI value not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI value updated successfully',
      data: kpiValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update KPI value',
      error: error.message
    });
  }
};

exports.deleteKPIValue = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await kpiValueModel.deleteKPIValue(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'KPI value not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI value deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete KPI value',
      error: error.message
    });
  }
};
