const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 10000
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000000
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  validUntil: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Converted', 'Expired'],
    default: 'Draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

quotationSchema.path('items').validate((items) => items.length > 0 && items.length <= 100, 'Quotation must contain 1 to 100 items');

module.exports = mongoose.model('Quotation', quotationSchema);
