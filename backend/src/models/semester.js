const mongoose = require('mongoose');
const semesterSchema = new mongoose.Schema({ courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, name: { type: String, required: true }, number: Number, startDate: Date, endDate: Date }, { timestamps: true });
module.exports = mongoose.model('Semester', semesterSchema);
