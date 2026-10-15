const mongoose = require('mongoose');
const departmentSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, code: String, headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' } }, { timestamps: true });
module.exports = mongoose.model('Department', departmentSchema);
