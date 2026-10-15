const mongoose = require('mongoose');
const hallTicketSchema = new mongoose.Schema({ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' }, examCenter: String, dateIssued: { type: Date, default: Date.now } }, { timestamps: true });
module.exports = mongoose.model('HallTicket', hallTicketSchema);
