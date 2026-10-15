const mongoose = require('mongoose');
const generatedCertificateSchema = new mongoose.Schema({ certificateNumber: { type: String, required: true, unique: true }, studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate' }, generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, date: { type: Date, default: Date.now }, fileUrl: String }, { timestamps: true });
module.exports = mongoose.model('GeneratedCertificate', generatedCertificateSchema);
