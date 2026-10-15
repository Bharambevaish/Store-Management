const mongoose = require('mongoose');

const documentSetupSchema = new mongoose.Schema({
  documentId: { type: String, unique: true },
  documentTitle: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  documentType: { type: String },
  applicableFor: { type: String },
  isMandatory: { type: Boolean, default: false },
  allowUpload: { type: Boolean, default: true },
  allowMultipleFiles: { type: Boolean, default: false },
  maxFileSize: { type: Number, default: 2 }, // in MB
  allowedFileTypes: { type: String, default: '.pdf,.png,.jpg' },
  displayOrder: { type: Number, default: 0 },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

// Auto generate documentId
documentSetupSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('DocumentSetup').countDocuments();
    this.documentId = `DOC-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('DocumentSetup', documentSetupSchema);
