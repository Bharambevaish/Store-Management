const mongoose = require('mongoose');

const documentRegisterSchema = new mongoose.Schema({
  registerId: { type: String, unique: true },
  documentNumber: { type: String },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, // Link to Student
  studentName: { type: String },
  rollNumber: { type: String },
  documentType: { type: String },
  generatedBy: { type: String },
  approvedBy: { type: String },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'Generated' },
  fileUrl: { type: String }
}, { timestamps: true });

// Auto generate registerId
documentRegisterSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('DocumentRegister').countDocuments();
    this.registerId = `REG-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('DocumentRegister', documentRegisterSchema);
