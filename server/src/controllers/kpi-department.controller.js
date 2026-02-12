const kpiDepartmentModel = require('../models/kpi-department.model');

exports.getAllKPIDepartments = async (req, res) => {
  try {
    const { kpi_id } = req.query;

    if (kpi_id !== undefined) {
      const kpiId = parseInt(kpi_id, 10);
      if (Number.isNaN(kpiId)) {
        return res.status(400).json({ success: false, message: 'Invalid kpi_id' });
      }

      const mappings = await kpiDepartmentModel.getKPIDepartmentsByKPI(kpiId);
      return res.status(200).json({ success: true, message: 'KPI-Department mappings retrieved successfully', data: mappings });
    }

    const mappings = await kpiDepartmentModel.getAllKPIDepartments();
    res.status(200).json({ success: true, message: 'KPI-Department mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Department mappings', error: error.message });
  }
};

exports.getKPIDepartmentsByKPI = async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId, 10);
    if (Number.isNaN(kpiId)) return res.status(400).json({ success: false, message: 'Invalid kpiId' });

    const mappings = await kpiDepartmentModel.getKPIDepartmentsByKPI(kpiId);
    res.status(200).json({ success: true, message: 'KPI-Department mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Department mappings', error: error.message });
  }
};

exports.getKPIDepartmentsByDepartment = async (req, res) => {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    if (Number.isNaN(departmentId)) return res.status(400).json({ success: false, message: 'Invalid departmentId' });

    const mappings = await kpiDepartmentModel.getKPIDepartmentsByDepartment(departmentId);
    res.status(200).json({ success: true, message: 'KPI-Department mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Department mappings', error: error.message });
  }
};

exports.createKPIDepartment = async (req, res) => {
  try {
    const { kpi_id, department_id } = req.body;

    if (kpi_id === undefined || department_id === undefined) {
      return res.status(400).json({ success: false, message: 'kpi_id and department_id are required' });
    }

    const kpiId = parseInt(kpi_id, 10);
    const departmentId = parseInt(department_id, 10);
    if (Number.isNaN(kpiId) || Number.isNaN(departmentId)) {
      return res.status(400).json({ success: false, message: 'kpi_id and department_id must be integers' });
    }

    const exists = await kpiDepartmentModel.mappingExists(kpiId, departmentId);
    if (exists) return res.status(400).json({ success: false, message: 'Mapping already exists' });

    const mapping = await kpiDepartmentModel.createKPIDepartment(kpiId, departmentId);
    res.status(201).json({ success: true, message: 'KPI-Department mapping created successfully', data: mapping });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create KPI-Department mapping', error: error.message });
  }
};

exports.deleteKPIDepartment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const result = await kpiDepartmentModel.deleteKPIDepartment(id);
    if (!result) return res.status(404).json({ success: false, message: 'Mapping not found' });

    res.status(200).json({ success: true, message: 'Mapping deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete mapping', error: error.message });
  }
};

exports.deleteKPIDepartmentsByKPI = async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId, 10);
    if (Number.isNaN(kpiId)) return res.status(400).json({ success: false, message: 'Invalid kpiId' });

    const deletedCount = await kpiDepartmentModel.deleteKPIDepartmentsByKPI(kpiId);
    res.status(200).json({ success: true, message: `${deletedCount} mapping(s) deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete mappings', error: error.message });
  }
};



