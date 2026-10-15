const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Bonafide Certificate', 'Leaving Certificate', 'Railway Concession', 'Character Certificate', 'NOC', 'General Document']
  },
  rollNumber: { type: String },
  admissionNumber: { type: String },
  course: { type: String },
  semester: { type: String },
  details: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  remarks: {
    type: String,
    default: ''
  },
  facultyRemarks: {
    type: String,
    default: ''
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Application', applicationSchema);
