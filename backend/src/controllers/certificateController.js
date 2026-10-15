const CertificateTemplate = require('../models/certificateTemplate');
const GeneratedCertificate = require('../models/generatedCertificate');
exports.getAllTemplates = async (req, res) => { try { const data = await CertificateTemplate.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.getAllGenerated = async (req, res) => { try { const data = await GeneratedCertificate.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
