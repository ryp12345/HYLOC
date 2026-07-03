const kpiValueModel = require('../models/kpi-value.model');
const pool = require('../config/db');

exports.getAllKPIValues = async (req, res) => {
  try {
    const { kpi_id } = req.query;
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id;
    
    if (kpi_id) {
      if (userRole === 'employee' || userRole === 'manager') {
        try {
          // Get user's empid first
          const userResult = await pool.query('SELECT empid FROM users WHERE id = $1', [userId]);
          if (userResult.rows.length === 0) {
            return res.status(200).json({
              success: true,
              message: 'KPI values retrieved successfully',
              data: []
            });
          }
          
          const userEmpid = userResult.rows[0].empid;
          
          // Filter by data operator empid
          const result = await pool.query(
            `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
                    kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
                    kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
                    kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
             FROM kpi_values kv
             WHERE kv.kpi_id = $1 AND kv."data operator" = $2
             ORDER BY kv.created_at DESC`,
            [kpi_id, userEmpid]
          );
          return res.status(200).json({
            success: true,
            message: 'KPI values retrieved successfully',
            data: result.rows
          });
        } catch (queryError) {
          console.error('Error retrieving KPI values for employee/manager:', queryError.message);
          throw queryError;
        }
      }
      
      const values = await kpiValueModel.getKPIValuesByKPI(kpi_id);
      return res.status(200).json({
        success: true,
        message: 'KPI values retrieved successfully',
        data: values
      });
    }
    
    // Get all KPI values based on role
    let values;
    
    if (userRole === 'employee' || userRole === 'manager') {
      try {
        // Get user's empid first
        const userResult = await pool.query('SELECT empid FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          values = [];
        } else {
          const userEmpid = userResult.rows[0].empid;
          const result = await pool.query(
            `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
                    kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
                    kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
                    kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
             FROM kpi_values kv
             WHERE kv."data operator" = $1
             ORDER BY kv.created_at DESC`,
            [userEmpid]
          );
          values = result.rows;
        }
      } catch (err) {
        console.error('[KPI Values] Error querying employee/manager values:', err.message);
        throw err;
      }
    } else {
      try {
        values = await kpiValueModel.getAllKPIValues();
      } catch (err) {
        console.error('[KPI Values] Error querying all values:', err.message);
        throw err;
      }
    }
    
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
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id;

    const values = await kpiValueModel.getKPIValuesByKPI(kpiId);

    if (userRole === 'employee' || userRole === 'manager') {
      const userResult = await pool.query('SELECT empid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'KPI values retrieved successfully',
          data: []
        });
      }
      const userEmpid = userResult.rows[0].empid;
      const filteredValues = values.filter(v => v.data_operator === userEmpid);
      return res.status(200).json({
        success: true,
        message: 'KPI values retrieved successfully',
        data: filteredValues
      });
    }

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

exports.getKPIValuesByPillar = async (req, res) => {
  try {
    const { pillerId } = req.params;
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id;

    const values = await kpiValueModel.getKPIValuesByPillar(pillerId);

    if (userRole === 'employee' || userRole === 'manager') {
      const userResult = await pool.query('SELECT empid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'KPI values retrieved successfully',
          data: []
        });
      }
      const userEmpid = userResult.rows[0].empid;
      const filteredValues = values.filter(v => v.data_operator === userEmpid);
      return res.status(200).json({
        success: true,
        message: 'KPI values retrieved successfully',
        data: filteredValues
      });
    }

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
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const userId = req.user?.userId || req.user?.id; // JWT has userId field

    const value = await kpiValueModel.getKPIValueById(id);

    if (!value) {
      return res.status(404).json({
        success: false,
        message: 'KPI value not found'
      });
    }

    if (userRole === 'employee' || userRole === 'manager') {
      const userResult = await pool.query('SELECT empid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this KPI value.'
        });
      }
      const userEmpid = userResult.rows[0].empid;
      if (value.data_operator !== userEmpid) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this KPI value.'
        });
      }
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

exports.getKPIValueByData = async (req, res) => {
  try {
    const { dataValue } = req.query;
    
    if (!dataValue) {
      return res.status(400).json({
        success: false,
        message: 'dataValue query parameter is required'
      });
    }
    
    const value = await kpiValueModel.getKPIValueByData(dataValue);
    
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



