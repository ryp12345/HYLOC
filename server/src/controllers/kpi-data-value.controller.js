const kpiDataValueModel = require('../models/kpi-data-value.model');
const pool = require('../config/db');

exports.getAllKPIDataValues = async (req, res) => {
  try {
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id;
    
    if (userRole === 'employee' || userRole === 'hod') {
      const result = await pool.query(
        `SELECT kdv.id, kdv.kpi_value_id, kdv.value, kdv.value_type, kdv.month, kdv.year, 
                kdv.created_at, kdv.updated_at
         FROM kpi_data_value kdv
         JOIN kpi_values kv ON kv.id = kdv.kpi_value_id
         JOIN users u ON kv."data operator" = u.empid
         WHERE u.id = $1
         ORDER BY kdv.year DESC, kdv.month DESC`,
        [userId]
      );
      
      return res.status(200).json({
        success: true,
        message: 'KPI data values retrieved successfully',
        data: result.rows
      });
    }
    
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
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id;
    
    if (userRole === 'employee' || userRole === 'hod') {
      const checkResult = await pool.query(
        `SELECT kv.id 
         FROM kpi_values kv
         JOIN users u ON kv."data operator" = u.empid
         WHERE kv.id = $1 AND u.id = $2`,
        [kpiValueId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this KPI data.'
        });
      }
    }

    const rawData = await kpiDataValueModel.getMonthlyDataByKPIValue(
      kpiValueId,
      year ? parseInt(year) : null
    );

    // Transform value_type to match frontend expectations
    // Database: 'target', 'actual' -> Frontend: 'Target', 'Achieved'
    const transformedData = rawData.map(row => ({
      ...row,
      value_type: row.value_type === 'target' ? 'Target' : 
                  row.value_type === 'actual' ? 'Achieved' : 
                  row.value_type.charAt(0).toUpperCase() + row.value_type.slice(1)
    }));

    res.status(200).json({
      success: true,
      message: 'Monthly data retrieved successfully',
      data: transformedData
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
