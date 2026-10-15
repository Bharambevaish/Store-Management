const mongoose = require('mongoose');

// A receipt is an inline data URI that the UI renders and opens in a new tab.
// Constraining it to an image or PDF payload here stops a stored `javascript:`
// or HTML-bearing value from ever reaching that sink.
const RECEIPT_DATA_URI = /^data:(image\/(png|jpe?g|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/;

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['rent', 'salary', 'fuel', 'misc'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    max: 1000000000
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  receiptImage: {
    type: String, // Base64 data URI for an image or PDF
    default: '',
    maxlength: 750000,
    validate: {
      validator: (value) => !value || RECEIPT_DATA_URI.test(value),
      message: 'A receipt must be a base64 image or PDF data URI',
    }
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Expense', expenseSchema);
