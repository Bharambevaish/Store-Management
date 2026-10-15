const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: false,   // Optional — manual ledger payments may not have a linked bill
    default: null
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
  amountPaid: {
    type: Number,
    required: true,
    min: 0.01,
    max: 1000000000
  },
  paymentMode: {
    type: String,
    enum: [
      'cash', 'Cash',
      'UPI', 'UPI / QR',
      'bank transfer', 'Bank Transfer', 'Bank Transfer / NEFT',
      'cheque', 'Cheque',
      'Credit Card', 'Credit / Debit Card',
      'Other'
    ],
    required: true
  },
  category: {
    type: String,
    default: 'Ledger Settlement',
    trim: true,
    maxlength: 100
  },
  date: {
    type: Date,
    default: Date.now
  },
  referenceNumber: {
    type: String,
    default: '',
    trim: true,
    maxlength: 100
  },
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
