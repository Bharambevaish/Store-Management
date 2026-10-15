const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{10}$/
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  performanceScore: { type: Number, default: 100, min: 0, max: 100 },
  qualityRating: { type: Number, default: 5, min: 1, max: 5 },
  itemCategories: {
    type: [String],
    default: [],
    validate: {
      validator: (items) => items.length <= 50 && items.every((item) => typeof item === 'string' && item.length <= 100),
      message: 'Item categories are invalid'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);
