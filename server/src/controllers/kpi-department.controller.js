const kpiDepartmentModel = require('../models/kpi-department.model');

exports.getAllKPIDepartments = async (req, res) => {
  try {
    const { kpi_id } = req.query;
    
    if (kpi_id) {
      const mappings = await kpiDepartmentModel.getKPIDepartmentsByKPI(kpi_id);
      return res.status(200).json({
        success: true,
        message: 'KPI-Department mappings retrieved successfully',
        data: mappings
      });
    }
    
    const mappings = await kpiDepartmentModel.getAllKPIDepartments();
    res.status(200).json({
      success: true,
      message: 'KPI-Department mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Department mappings',
      error: error.message
    });
  }
};

exports.getKPIDepartmentsByKPI = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const mappings = await kpiDepartmentModel.getKPIDepartmentsByKPI(kpiId);
    
    res.status(200).json({
      success: true,
      message: 'KPI-Department mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Department mappings',
      error: error.message
    });
  }
};

exports.getKPIDepartmentsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const mappings = await kpiDepartmentModel.getKPIDepartmentsByDepartment(departmentId);
    
    res.status(200).json({
      success: true,
      message: 'KPI-Department mappings retrieved successfully',
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI-Department mappings',
      error: error.message
    });
  }
};

exports.createKPIDepartment = async (req, res) => {
  try {
    const { kpi_id, department_id } = req.body;

    if (!kpi_id || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'kpi_id and department_id are required'
      });
    }

    // Check if mapping already exists
    const exists = await kpiDepartmentModel.mappingExists(kpi_id, department_id);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Mapping already exists'
      });
    }

    const mapping = await kpiDepartmentModel.createKPIDepartment(kpi_id, department_id);

    res.status(201).json({
      success: true,
      message: 'KPI-Department mapping created successfully',
      data: mapping
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create KPI-Department mapping',
      error: error.message
    });
  }
};

exports.deleteKPIDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await kpiDepartmentModel.deleteKPIDepartment(id);

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

exports.deleteKPIDepartmentsByKPI = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const result = await kpiDepartmentModel.deleteKPIDepartmentsByKPI(kpiId);

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
