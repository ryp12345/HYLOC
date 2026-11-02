const UnitMaster = require('../models/unitMaster.model');

exports.getAllUnits = async (req, res) => {
  try {
    const units = await UnitMaster.findAll();
    res.status(200).json({ success: true, data: units });
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getUnitById = async (req, res) => {
  try {
    const unit = await UnitMaster.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, error: 'Unit not found' });
    res.status(200).json({ success: true, data: unit });
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const unit = await UnitMaster.create(req.body);
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const unit = await UnitMaster.update(req.params.id, req.body);
    if (!unit) return res.status(404).json({ success: false, error: 'Unit not found' });
    res.status(200).json({ success: true, data: unit });
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const unit = await UnitMaster.delete(req.params.id);
    if (!unit) return res.status(404).json({ success: false, error: 'Unit not found' });
    res.status(200).json({ success: true, data: unit });
  } catch (error) {
    console.error('Controller operation failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
