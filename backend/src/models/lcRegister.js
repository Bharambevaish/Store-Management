const mongoose = require('mongoose');
const lcRegisterSchema = new mongoose.Schema({ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, reason: String, dateIssued: { type: Date, default: Date.now }, issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
module.exports = mongoose.model('LCRegister', lcRegisterSchema);
