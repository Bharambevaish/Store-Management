const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['Leaving', 'Bonafide'],
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  serialNumber: {
    type: String,
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Issued', 'Cancelled'],
    default: 'Issued'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Certificate', certificateSchema);
