const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'global',
    unique: true
  },
  academicYear: {
    type: String,
    default: '2026-27'
  },
  departments: {
    type: [String],
    default: ['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering']
  },
  courses: {
    type: [String],
    default: ['B.Tech Computer Engineering', 'B.Tech IT', 'B.Tech EXTC', 'M.Tech Computer Engineering', 'Diploma in Engineering']
  },
  documentTypes: {
    type: [String],
    default: ['Aadhaar', 'Marksheet', 'Leaving Certificate', 'Photo', 'Income Certificate']
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Settings', settingsSchema);
