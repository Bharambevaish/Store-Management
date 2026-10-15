const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    max: 1000000000
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Requested', 'Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  assignedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  latitude: {
    type: Number,
    default: 0
  },
  longitude: {
    type: Number,
    default: 0
  },
  deliveryProofUrl: {
    type: String,
    default: ''
  },
  signatureUrl: {
    type: String,
    default: ''
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  feedbackRating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedbackComment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  remarks: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  assignmentHistory: [{
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedBy: { type: String, default: 'Admin' },
    date: { type: Date, default: Date.now }
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  isGstApplicable: {
    type: Boolean,
    default: false
  },
  recurringIntervalDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365
  },
  recurringSourceOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  recurringProcessed: {
    type: Boolean,
    default: false
  },
  recurringProcessingAt: {
    type: Date,
    default: null,
    select: false
  },
  paymentOrderId: {
    type: String,
    default: null
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

orderSchema.path('items').validate((items) => items.length > 0 && items.length <= 100, 'Order must contain 1 to 100 items');

module.exports = mongoose.model('Order', orderSchema);
