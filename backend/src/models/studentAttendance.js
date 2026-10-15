const mongoose = require('mongoose');
const studentAttendanceSchema = new mongoose.Schema({ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, date: Date, status: { type: String, enum: ['Present', 'Absent', 'Late'] }, remarks: String }, { timestamps: true });
module.exports = mongoose.model('StudentAttendance', studentAttendanceSchema);
