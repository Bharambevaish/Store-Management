const FeeStructure = require('../models/feeStructure');

exports.getFeeStructures = async (req, res) => {
  try {
    const structures = await FeeStructure.find().sort({ name: 1 });
    res.json(structures);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
};

exports.createFeeStructure = async (req, res) => {
  try {
    const { name, amount, applicableYear, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const exists = await FeeStructure.findOne({ name });
    if (exists) return res.status(400).json({ error: 'Fee structure with this name already exists' });

    const newStructure = new FeeStructure({ name, amount, applicableYear, description });
    await newStructure.save();
    res.status(201).json(newStructure);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create fee structure' });
  }
};

exports.deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    await FeeStructure.findByIdAndDelete(id);
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
};
