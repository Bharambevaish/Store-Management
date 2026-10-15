const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  password: {
    type: String,
    required: true,
    minlength: 16,
    maxlength: 128,
    select: false
  },
  role: {
    type: String,
    enum: ['admin'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  mobile: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{10}$/
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  // Tokens issued before this instant are rejected, so rotating the password
  // ends every session that was open when the password changed.
  passwordChangedAt: {
    type: Date,
    default: Date.now,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const removePassword = (_doc, value) => {
  delete value.password;
  delete value.passwordChangedAt;
  return value;
};
userSchema.set('toJSON', { transform: removePassword });
userSchema.set('toObject', { transform: removePassword });

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    // JWT `iat` has one-second resolution. Backdating by one second keeps a
    // token minted in the same second as the change from surviving it.
    this.passwordChangedAt = new Date(Date.now() - 1000);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
