const mongoose = require('mongoose');

const passingRemarkSchema = new mongoose.Schema({ 
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  passingRemark: { type: String, required: true },
  effectiveAcademicYear: { type: String },
  remarkDate: { type: Date, default: Date.now },
  remarkBy: { type: String },
  additionalNotes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PassingRemark', passingRemarkSchema);
