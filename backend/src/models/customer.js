const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^\d{10}$/
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  gstNumber: {
    type: String,
    trim: true,
    default: '',
    maxlength: 15
  },
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  state: {
    type: String,
    default: 'Maharashtra',
    trim: true,
    maxlength: 100
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  defaultRecurringDays: {
    type: Number,
    default: 0,
    min: 0,
    max: 365
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0,
    max: 1000000000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Customer', customerSchema);
