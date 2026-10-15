const mongoose = require('mongoose');

const documentAuthoritySchema = new mongoose.Schema({
  authorityId: { type: String, unique: true },
  employeeId: { type: String, required: true },
  authorityName: { type: String, required: true },
  designation: { type: String },
  department: { type: String },
  email: { type: String },
  mobile: { type: String },
  role: { type: String },
  canApprove: { type: Boolean, default: false },
  canReject: { type: Boolean, default: false },
  canVerify: { type: Boolean, default: false },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

// Auto generate authorityId
documentAuthoritySchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('DocumentAuthority').countDocuments();
    this.authorityId = `AUTH-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('DocumentAuthority', documentAuthoritySchema);
