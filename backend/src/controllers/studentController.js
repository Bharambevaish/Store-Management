const Student = require('../models/student');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.course) {
      // Allow course query (e.g. BTECH-IT) to match course or department
      const courseStr = req.query.course;
      const deptHint = courseStr.split('-')[1] || courseStr; // e.g. IT from BTECH-IT
      filter.$or = [
        { course: courseStr },
        { course: { $regex: courseStr, $options: 'i' } },
        { department: { $regex: deptHint, $options: 'i' } }
      ];
    }
    if (req.query.semester) {
      const sem = req.query.semester;
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: [{ semester: sem }, { semester: `Semester ${sem}` }] });
    }
    if (req.query.status) filter.studentStatus = req.query.status;
    if (req.query.studentStatus) filter.studentStatus = req.query.studentStatus;
    if (req.query.academicYear) {
      // Use regex so "2026-27" matches "2026" or "2026-27"
      filter.academicYear = { $regex: req.query.academicYear.substring(0,4), $options: 'i' };
    }
    if (req.query.admissionYear) {
      filter.admissionYear = { $regex: req.query.admissionYear.substring(0,4), $options: 'i' };
    }
    if (req.query.department) filter.department = req.query.department;
    if (req.query.division) filter.division = req.query.division;
    if (req.query.admissionType) filter.admissionType = req.query.admissionType;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.gender) filter.gender = req.query.gender;

    const data = await Student.find(filter).sort({ rollNumber: 1 });
    // Return both formats for compatibility:
    // - StudentPromotion expects { students: [...] }
    // - StudentProfile/Report expect plain array
    // We return { students: [...] } and also support plain array via .data directly
    res.json({ students: data, total: data.length });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = req.params.id;
    let data;
    if (id.length === 24) { data = await Student.findById(id); }
    if (!data) { data = await Student.findOne({ studentId: id }); }
    if (!data) return res.status(404).json({ error: 'Student not found' });
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  try { const data = new Student(req.body); await data.save(); res.status(201).json(data); }
  catch(err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try { const data = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(data); }
  catch(err) { res.status(500).json({ error: err.message }); }
};

exports.delete = async (req, res) => {
  try { await Student.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch(err) { res.status(500).json({ error: err.message }); }
};

exports.promote = async (req, res) => {
  try {
    const { fromCourse, fromSemester, toSemester, studentIds } = req.body;
    if (!studentIds || !studentIds.length) {
      return res.status(400).json({ error: 'No student IDs provided' });
    }
    const result = await Student.updateMany(
      { studentId: { $in: studentIds } },
      { $set: { semester: toSemester } }
    );
    res.json({ message: `${result.modifiedCount} student(s) promoted to Semester ${toSemester} successfully!`, modifiedCount: result.modifiedCount });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

