const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  unit: {
    type: String,
    required: true, // kg, pcs, litre, box, etc.
    trim: true,
    maxlength: 30
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 10000000
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0,
    max: 10000000
  },
  lowStockThreshold: {
    type: Number,
    required: true,
    default: 10,
    min: 0,
    max: 10000000
  },
  linkedVendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  hsnCode: {
    type: String,
    default: '3004',
    trim: true,
    // Accept the legacy HSN prefix while old records are migrated; all new
    // controller defaults use the normalized numeric representation.
    match: /^(?:HSN)?(?:\d{4}|\d{6}|\d{8})$/i
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0,
    max: 1000000000
  },
  hasExpiryTracking: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
