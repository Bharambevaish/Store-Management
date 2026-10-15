const mongoose = require('mongoose');

const documentSettingSchema = new mongoose.Schema({
  defaultUploadPath: { type: String, default: '/uploads/documents/' },
  maximumUploadSize: { type: Number, default: 5 }, // MB
  allowedFileExtensions: { type: String, default: '.pdf, .jpg, .png' },
  imageCompression: { type: Boolean, default: true },
  pdfPreview: { type: Boolean, default: true },
  autoRenameFiles: { type: Boolean, default: true },
  duplicateUploadPolicy: { type: String, default: 'Overwrite' }, // Overwrite, Reject, Keep Both
  documentVersioning: { type: Boolean, default: false },
  softDelete: { type: Boolean, default: true },
  enableAuditLogs: { type: Boolean, default: true },
  enableDocumentVerification: { type: Boolean, default: false },
  enableDigitalSignature: { type: Boolean, default: false },
  enableDownloadPermission: { type: Boolean, default: true },
  enablePrintPermission: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DocumentSetting', documentSettingSchema);
