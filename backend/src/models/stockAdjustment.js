const mongoose = require('mongoose');

const stockAdjustmentSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  oldQty: {
    type: Number,
    required: true,
    min: 0,
    max: 10000000
  },
  newQty: {
    type: Number,
    required: true,
    min: 0,
    max: 10000000
  },
  adjustedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
