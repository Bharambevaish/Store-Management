const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, trim: true },
  name: { type: String, required: true, trim: true }, // Subject Name
  subjectShortName: { type: String, trim: true },
  subjectType: { type: String, enum: ['Theory', 'Practical', 'Project', 'Lab', 'Elective', ''], default: 'Theory' },
  department: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  branch: { type: String, trim: true },
  semester: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  credits: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
  internalMarks: { type: Number, default: 0 },
  externalMarks: { type: Number, default: 0 },
  passingMarks: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  faculty: { type: mongoose.Schema.Types.Mixed }, // Could be string or ObjectId depending on system usage
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subject', subjectSchema);
