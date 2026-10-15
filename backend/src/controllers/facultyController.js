const Faculty = require('../models/faculty');
exports.getAll = async (req, res) => { try { const data = await Faculty.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.getById = async (req, res) => {
  try {
    const id = req.params.id;
    let data;
    if (id.length === 24) {
      data = await Faculty.findById(id);
    }
    if (!data) {
      data = await Faculty.findOne({ facultyId: id });
    }
    if (!data) return res.status(404).json({ error: 'Faculty not found' });
    res.json(data);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
};
exports.create = async (req, res) => {
  try {
    let payload = { ...req.body };
    if (!payload.facultyId) {
      const count = await Faculty.countDocuments();
      payload.facultyId = `FAC${2000 + count + 1}`;
    }
    const data = new Faculty(payload);
    await data.save();
    res.status(201).json(data);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
};
exports.update = async (req, res) => { try { const data = await Faculty.findByIdAndUpdate(req.params.id, req.body, {new: true}); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.delete = async (req, res) => { try { await Faculty.findByIdAndDelete(req.params.id); res.json({message: 'Deleted'}); } catch(err) { res.status(500).json({error: err.message}); } };
