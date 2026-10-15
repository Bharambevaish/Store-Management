const mongoose = require('mongoose');

const approvalPathSchema = new mongoose.Schema({
  pathName: { type: String, required: true, unique: true },
  status: { type: String, default: 'Active' },
  steps: [{
    authorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentAuthority' },
    order: { type: Number },
    actionType: { type: String, enum: ['Verify', 'Approve'], default: 'Approve' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ApprovalPath', approvalPathSchema);
