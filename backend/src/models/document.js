const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  studentObjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  studentName: {
    type: String,
    required: true
  },
  documentSetupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentSetup'
  },
  category: {
    type: String
  },
  documentType: {
    type: String, 
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String
  },
  fileContent: {
    type: String // Base64 content
  },
  filePath: {
    type: String
  },
  fileSize: {
    type: Number
  },
  fileType: {
    type: String
  },
  status: {
    type: String,
    enum: ['Not Uploaded', 'Uploaded', 'Pending Verification', 'Approved', 'Rejected'],
    default: 'Pending Verification'
  },
  verificationStatus: {
    type: String,
    enum: ['Pending Verification', 'Approved', 'Rejected'],
    default: 'Pending Verification'
  },
  verifiedBy: {
    type: String
  },
  verifiedDate: {
    type: Date
  },
  remarks: {
    type: String
  },
  uploadedBy: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
