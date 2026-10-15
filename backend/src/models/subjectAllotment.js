const mongoose = require('mongoose');

const subjectAllotmentSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  subjectName: { type: String }, // denormalized for quick querying if needed
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  facultyName: { type: String }, // denormalized
  academicYear: { type: String, required: true },
  department: { type: String, required: true },
  course: { type: String, required: true },
  branch: { type: String },
  semester: { type: String, required: true },
  division: { type: String, required: true },
  assignedDate: { type: Date, default: Date.now },
  assignedBy: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SubjectAllotment', subjectAllotmentSchema);
