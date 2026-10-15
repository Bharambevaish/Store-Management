const mongoose = require('mongoose');
const bonafideRegisterSchema = new mongoose.Schema({ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, purpose: String, dateIssued: { type: Date, default: Date.now }, issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
module.exports = mongoose.model('BonafideRegister', bonafideRegisterSchema);
