const mongoose = require('mongoose');
const academicRegisterSchema = new mongoose.Schema({ title: String, date: Date, type: String, details: String }, { timestamps: true });
module.exports = mongoose.model('AcademicRegister', academicRegisterSchema);
