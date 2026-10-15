const mongoose = require('mongoose');
const certificateTemplateSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, type: String, content: String }, { timestamps: true });
module.exports = mongoose.model('CertificateTemplate', certificateTemplateSchema);
