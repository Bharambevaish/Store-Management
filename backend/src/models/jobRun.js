const mongoose = require('mongoose');

const jobRunSchema = new mongoose.Schema({
  jobKey: {
    type: String,
    enum: ['recurring_orders'],
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['running', 'succeeded', 'failed'],
    required: true,
  },
  trigger: {
    type: String,
    enum: ['owner'],
    default: 'owner',
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  lastStartedAt: {
    type: Date,
    required: true,
  },
  lastCompletedAt: {
    type: Date,
    default: null,
  },
  lastSuccessfulRunAt: {
    type: Date,
    default: null,
  },
  lastResult: {
    scanned: { type: Number, min: 0, default: 0 },
    due: { type: Number, min: 0, default: 0 },
    created: { type: Number, min: 0, default: 0 },
    skipped: { type: Number, min: 0, default: 0 },
  },
  lastError: {
    type: String,
    maxlength: 200,
    select: false,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('JobRun', jobRunSchema);
