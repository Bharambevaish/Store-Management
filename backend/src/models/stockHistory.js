const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    max: 10000000
  },
  type: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  reason: {
    type: String,
    default: 'sale',
    trim: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);
