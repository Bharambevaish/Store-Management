const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor', // Reuses Vendor model
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
      max: 10000000
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000000
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      max: 10000000
    }
  }],
  totalCost: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Ordered', 'Partially Received', 'Fully Received', 'Received', 'Locked', 'Cancelled'],
    default: 'Pending'
  },
  receivingHistory: [{
    receivedBy: { type: String, default: 'Admin', maxlength: 100 },
    date: { type: Date, default: Date.now },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 0 },
      location: { type: String, default: '', maxlength: 200 },
      remarks: { type: String, default: '', maxlength: 1000 }
    }]
  }],
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

purchaseOrderSchema.path('items').validate((items) => items.length > 0 && items.length <= 100, 'Purchase order must contain 1 to 100 items');

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
