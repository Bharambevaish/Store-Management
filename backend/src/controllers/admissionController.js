const Admission = require('../models/admission');
exports.getAll = async (req, res) => { try { const data = await Admission.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.create = async (req, res) => { try { const data = new Admission(req.body); await data.save(); res.status(201).json(data); } catch(err) { res.status(500).json({error: err.message}); } };
