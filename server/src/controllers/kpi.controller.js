const kpiModel = require('../models/kpi.model');

exports.getAllKPIs = async (req, res) => {
  try {
    const kpis = await kpiModel.getAllKPIs();
    res.status(200).json({
      success: true,
      message: 'KPIs retrieved successfully',
      data: kpis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPIs',
      error: error.message
    });
  }
};

exports.getKPIById = async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = await kpiModel.getKPIById(id);
    
    if (!kpi) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'KPI retrieved successfully',
      data: kpi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPI',
      error: error.message
    });
  }
};

exports.getKPIsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const kpis = await kpiModel.getKPIsByCategory(categoryId);
    
    res.status(200).json({
      success: true,
      message: 'KPIs retrieved successfully',
      data: kpis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPIs',
      error: error.message
    });
  }
};

exports.getKPIsByFinYear = async (req, res) => {
  try {
    const { finYear } = req.params;
    const kpis = await kpiModel.getKPIsByFinYear(finYear);
    
    res.status(200).json({
      success: true,
      message: 'KPIs retrieved successfully',
      data: kpis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve KPIs',
      error: error.message
    });
  }
};

exports.createKPI = async (req, res) => {
  try {
    const { title, category_id, parent_kpi_id, fin_year } = req.body;

    if (!title || !category_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and category_id are required'
      });
    }

    const kpi = await kpiModel.createKPI(
      title,
      category_id,
      parent_kpi_id || null,
      fin_year || null
    );

    res.status(201).json({
      success: true,
      message: 'KPI created successfully',
      data: kpi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create KPI',
      error: error.message
    });
  }
};

exports.updateKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category_id, parent_kpi_id, fin_year } = req.body;

    const kpi = await kpiModel.updateKPI(
      id,
      title,
      category_id,
      parent_kpi_id,
      fin_year
    );

    if (!kpi) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI updated successfully',
      data: kpi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update KPI',
      error: error.message
    });
  }
};

exports.deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if KPI has children
    const hasChildren = await kpiModel.hasChildren(id);
    if (hasChildren) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete KPI with child KPIs. Delete children first.'
      });
    }

    const result = await kpiModel.deleteKPI(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'KPI deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete KPI',
      error: error.message
    });
  }
};



