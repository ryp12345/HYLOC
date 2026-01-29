const kpiEmployeeModel = require('../models/kpi-employee.model');

exports.getAllKPIEmployees = async (req, res) => {
  try {
    const { kpi_id } = req.query;
    
    if (kpi_id) {
      const mappings = await kpiEmployeeModel.getKPIEmployeesByKPI(kpi_id);
      return res.status(200).json({
        success: true,
        message: 'KPI-Employee mappings retrieved successfully',
        data: mappings
      });
    }
    
    const mappings = await kpiEmployeeModel.getAllKPIEmployees();
    res.status(200).json({
      success: true,
      message: 'KPI-Employee mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Employee mappings',
      error: error.message
    });
  }
};

exports.getKPIEmployeesByKPI = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const mappings = await kpiEmployeeModel.getKPIEmployeesByKPI(kpiId);
    
    res.status(200).json({
      success: true,
      message: 'KPI-Employee mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Employee mappings',
      error: error.message
    });
  }
};

exports.getKPIEmployeesByEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    const mappings = await kpiEmployeeModel.getKPIEmployeesByEmployee(empId);
    
    res.status(200).json({
      success: true,
      message: 'KPI-Employee mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Employee mappings',
      error: error.message
    });
  }
};

exports.createKPIEmployee = async (req, res) => {
  try {
    const { kpi_id, emp_id } = req.body;

    if (!kpi_id || !emp_id) {
      return res.status(400).json({
        success: false,
        message: 'kpi_id and emp_id are required'
      });
    }

    // Check if mapping already exists
    const exists = await kpiEmployeeModel.mappingExists(kpi_id, emp_id);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Mapping already exists'
      });
    }

    const mapping = await kpiEmployeeModel.createKPIEmployee(kpi_id, emp_id);

    res.status(201).json({
      success: true,
      message: 'KPI-Employee mapping created successfully',
      data: mapping
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create KPI-Employee mapping',
      error: error.message
    });
  }
};

exports.deleteKPIEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await kpiEmployeeModel.deleteKPIEmployee(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete mapping',
      error: error.message
    });
  }
};

exports.deleteKPIEmployeesByKPI = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const result = await kpiEmployeeModel.deleteKPIEmployeesByKPI(kpiId);

    res.status(200).json({
      success: true,
      message: `${result.length} mapping(s) deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete mappings',
      error: error.message
    });
  }
};
