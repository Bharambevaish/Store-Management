const mongoose = require('mongoose');

const docInOutSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  documentName: {
    type: String, // e.g. "Original 12th Marksheet", "Original LC"
    required: true
  },
  direction: {
    type: String,
    enum: ['In', 'Out'], // Inward (submitted by student), Outward (issued/returned to student)
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Returned', 'Issued'],
    default: 'Pending'
  },
  remarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DocumentInOut', docInOutSchema);
