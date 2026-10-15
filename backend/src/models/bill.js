const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
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
    },
    cgst: {
      type: Number,
      default: 0
    },
    sgst: {
      type: Number,
      default: 0
    },
    igst: {
      type: Number,
      default: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  cgstTotal: {
    type: Number,
    default: 0
  },
  sgstTotal: {
    type: Number,
    default: 0
  },
  igstTotal: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  isGstApplicable: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Unpaid', 'Partially Paid', 'Paid'],
    default: 'Unpaid'
  },
  quotationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    default: null
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  paymentOrderId: {
    type: String,
    default: null,
    maxlength: 200
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

billSchema.path('items').validate((items) => items.length > 0 && items.length <= 100, 'Bill must contain 1 to 100 items');

module.exports = mongoose.model('Bill', billSchema);
