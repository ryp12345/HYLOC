const kpiValueModel = require('../models/kpi-value.model');
const pool = require('../config/db');

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

// GET /api/kpi-values/:id/monthly-data/:year
// Fetch monthly data for a KPI value for a specific year (and next year if spanning calendar years)
exports.getMonthlyData = async (req, res) => {
  try {
    const { id, year } = req.params;
    const kpiValueId = parseInt(id, 10);
    const fyYear = parseInt(year, 10);

    if (!kpiValueId || !fyYear) {
      return res.status(400).json({
        success: false,
        message: 'kpiValueId and year are required'
      });
    }

    // For a financial year starting in fyYear, we need to get data from:
    // - April to December of fyYear
    // - January to March of (fyYear + 1)
    // So we query for year = fyYear OR year = (fyYear + 1)

    const result = await pool.query(
      `SELECT id, kpi_value_id, month, year, value, value_type, created_at, updated_at
       FROM kpi_data_value
       WHERE kpi_value_id = $1 AND (year = $2 OR year = $3)
       ORDER BY year, month ASC`,
      [kpiValueId, fyYear, fyYear + 1]
    );

    // Transform the data to have target_value and actual_value as separate fields
    const monthlyDataMap = {};
    result.rows.forEach(row => {
      const key = `${row.month}_${row.year}`;
      if (!monthlyDataMap[key]) {
        monthlyDataMap[key] = {
          month: row.month,
          year: row.year,
          target_value: null,
          actual_value: null
        };
      }
      if (row.value_type === 'target') {
        monthlyDataMap[key].target_value = row.value;
      } else if (row.value_type === 'actual') {
        monthlyDataMap[key].actual_value = row.value;
      }
    });

    const data = Object.values(monthlyDataMap);

    res.status(200).json({
      success: true,
      message: 'Monthly data retrieved successfully',
      data: data
    });
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly data',
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
      default_target_value,
      computation_type,
      target_formula,
      target_source_kpi_value_ids
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
      default_target_value,
      computation_type,
      target_formula,
      target_source_kpi_value_ids
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
      default_target_value,
      computation_type,
      target_formula,
      target_source_kpi_value_ids
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
        default_target_value,
        computation_type,
        target_formula,
        target_source_kpi_value_ids
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



