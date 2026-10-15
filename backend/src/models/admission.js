const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  formNumber: {
    type: String,
    required: true,
    unique: true
  },
  studentDetails: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    parentDetails: {
      fatherName: { type: String, required: true },
      motherName: { type: String, required: true },
      parentMobile: { type: String, required: true }
    },
    course: { type: String, required: true },
    department: { type: String, required: true },
    semester: { type: String, required: true },
    photo: { type: String }
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  remarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Admission', admissionSchema);
