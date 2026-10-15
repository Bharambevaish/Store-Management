const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  applicableYear: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
