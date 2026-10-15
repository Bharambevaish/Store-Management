const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for system/anonymous actions
  },
  action: {
    type: String,
    required: true // create, update, delete
  },
  entity: {
    type: String,
    required: true // Customer, Product, Order, Bill, Payment, etc.
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  diff: {
    type: String, // String representation or JSON string of change summary/diff
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
