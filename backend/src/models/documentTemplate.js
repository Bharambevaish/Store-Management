const mongoose = require('mongoose');

const documentTemplateSchema = new mongoose.Schema({
  templateName: { type: String, required: true, unique: true },
  richTextContent: { type: String, default: '' },
  header: { type: String },
  footer: { type: String },
  logo: { type: String },
  watermark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
