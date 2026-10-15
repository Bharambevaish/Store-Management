const mongoose = require('mongoose');

const instituteProfileSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'profile',
    unique: true
  },
  name: {
    type: String,
    default: 'Demo Institute'
  },
  address: {
    type: String,
    default: '123 Academic Square, Science City, IN 400001'
  },
  logo: {
    type: String, // base64 representation
    default: ''
  },
  contact: {
    type: String,
    default: '+91-9876543210'
  },
  email: {
    type: String,
    default: 'info@studentinformationsysteminstitute.edu'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('InstituteProfile', instituteProfileSchema);
