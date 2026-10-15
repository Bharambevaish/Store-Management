const mongoose = require('mongoose');

const studentPromotionSchema = new mongoose.Schema({ 
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  prevAcademicYear: String,
  prevSemester: String,
  prevDivision: String,
  prevSection: String,
  newAcademicYear: String,
  newSemester: String,
  newDivision: String,
  newSection: String,
  promotionDate: { type: Date, default: Date.now },
  performedBy: String,
  status: { type: String, required: true }, // Promote, Repeat Semester, Detain, Alumni, Dropout
  remarks: String
}, { timestamps: true });

module.exports = mongoose.model('StudentPromotion', studentPromotionSchema);
