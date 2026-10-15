const mongoose = require('mongoose');
const railwayConcessionSchema = new mongoose.Schema({ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, fromStation: String, toStation: String, dateIssued: { type: Date, default: Date.now }, status: { type: String, default: 'Pending' } }, { timestamps: true });
module.exports = mongoose.model('RailwayConcession', railwayConcessionSchema);
