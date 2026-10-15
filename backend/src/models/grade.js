const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  studentId: {
    type: String, // String ID for simplicity, typically it would be an ObjectId ref, but we will match what the frontend uses for lookups.
    required: true,
    index: true
  },
  courseId: {
    type: String
  },
  semester: {
    type: String
  },
  subject: {
    type: String,
    required: true
  },
  marks: {
    type: Number,
    required: true
  },
  grade: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Grade', gradeSchema);
