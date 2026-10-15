const PassingRemark = require('../models/passingRemark');
const Student = require('../models/student');

exports.bulkSaveRemarks = async (req, res) => {
  try {
    const { studentIds, passingRemark, effectiveAcademicYear, remarkDate, remarkBy, additionalNotes } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'No students provided for bulk update.' });
    }

    if (!passingRemark) {
      return res.status(400).json({ error: 'Passing remark is required.' });
    }

    const remarksToInsert = studentIds.map(id => ({
      studentId: id,
      passingRemark,
      effectiveAcademicYear,
      remarkDate: remarkDate || new Date(),
      remarkBy: remarkBy || 'System/Admin',
      additionalNotes
    }));

    // 1. Insert history records
    await PassingRemark.insertMany(remarksToInsert);

    // 2. Update Student profiles
    await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          passingRemark,
          effectiveAcademicYear,
          remarkDate: remarkDate || new Date(),
          remarkBy: remarkBy || 'System/Admin',
          remarks: additionalNotes || '' // update existing remarks field for backward compatibility/notes
        }
      }
    );

    res.json({ message: `Successfully updated passing remarks for ${studentIds.length} students.` });
  } catch (err) {
    console.error('Error in bulkSaveRemarks:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const studentIdParam = req.params.studentId;
    const Student = require('../models/student');
    let filter = {};
    if (studentIdParam.length === 24) {
      filter.studentId = studentIdParam;
    } else {
      const student = await Student.findOne({ studentId: studentIdParam });
      if (!student) return res.status(404).json({ error: 'Student not found' });
      filter.studentId = student._id;
    }
    const history = await PassingRemark.find(filter).sort({ remarkDate: -1, createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
