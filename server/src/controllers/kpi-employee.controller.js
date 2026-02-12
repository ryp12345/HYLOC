const KPIEmployee = require('../models/kpi-employee.model');

exports.getAllKPIEmployees = async (req, res) => {
  try {
    const { kpi_id, emp_id } = req.query;

    if (kpi_id !== undefined) {
      const kpiId = parseInt(kpi_id, 10);
      if (Number.isNaN(kpiId)) {
        return res.status(400).json({ success: false, message: 'Invalid kpi_id' });
      }

      const mappings = await KPIEmployee.findByKPI(kpiId);
      return res.status(200).json({ success: true, message: 'KPI-Employee mappings retrieved successfully', data: mappings });
    }

    if (emp_id !== undefined) {
      const empId = parseInt(emp_id, 10);
      if (Number.isNaN(empId)) {
        return res.status(400).json({ success: false, message: 'Invalid emp_id' });
      }

      const mappings = await KPIEmployee.findByEmployee(empId);
      return res.status(200).json({ success: true, message: 'KPI-Employee mappings retrieved successfully', data: mappings });
    }

    const mappings = await KPIEmployee.findAll();
    res.status(200).json({ success: true, message: 'KPI-Employee mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Employee mappings', error: error.message });
  }
};

exports.getKPIEmployeesByKPI = async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId, 10);
    if (Number.isNaN(kpiId)) return res.status(400).json({ success: false, message: 'Invalid kpiId' });

    const mappings = await KPIEmployee.findByKPI(kpiId);
    res.status(200).json({ success: true, message: 'KPI-Employee mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Employee mappings', error: error.message });
  }
};

exports.getKPIEmployeesByEmployee = async (req, res) => {
  try {
    const empId = parseInt(req.params.empId, 10);
    if (Number.isNaN(empId)) return res.status(400).json({ success: false, message: 'Invalid empId' });

    const mappings = await KPIEmployee.findByEmployee(empId);
    res.status(200).json({ success: true, message: 'KPI-Employee mappings retrieved successfully', data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve KPI-Employee mappings', error: error.message });
  }
};

exports.createKPIEmployee = async (req, res) => {
  try {
    const { kpi_id, emp_id } = req.body;

    if (kpi_id === undefined || emp_id === undefined) {
      return res.status(400).json({ success: false, message: 'kpi_id and emp_id are required' });
    }

    const kpiId = parseInt(kpi_id, 10);
    const empId = parseInt(emp_id, 10);
    if (Number.isNaN(kpiId) || Number.isNaN(empId)) {
      return res.status(400).json({ success: false, message: 'kpi_id and emp_id must be integers' });
    }

    const exists = await KPIEmployee.mappingExists(kpiId, empId);
    if (exists) return res.status(400).json({ success: false, message: 'Mapping already exists' });

    const mapping = await KPIEmployee.create(kpiId, empId);
    res.status(201).json({ success: true, message: 'KPI-Employee mapping created successfully', data: mapping });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create KPI-Employee mapping', error: error.message });
  }
};

exports.deleteKPIEmployee = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const result = await KPIEmployee.delete(id);
    if (!result) return res.status(404).json({ success: false, message: 'Mapping not found' });

    res.status(200).json({ success: true, message: 'Mapping deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete mapping', error: error.message });
  }
};

exports.deleteKPIEmployeesByKPI = async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId, 10);
    if (Number.isNaN(kpiId)) return res.status(400).json({ success: false, message: 'Invalid kpiId' });

    const deletedMappings = await KPIEmployee.deleteByKPI(kpiId);
    res.status(200).json({ success: true, message: `${deletedMappings.length} mapping(s) deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete mappings', error: error.message });
  }
};
