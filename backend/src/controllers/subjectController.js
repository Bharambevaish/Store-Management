const Subject = require('../models/subject');
const SubjectAllotment = require('../models/subjectAllotment');
const Faculty = require('../models/faculty');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.course) filter.course = req.query.course;
    if (req.query.semester) filter.semester = req.query.semester;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    
    const subjects = await Subject.find(filter).sort({ createdAt: -1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const existing = await Subject.findOne({ 
      subjectCode: req.body.subjectCode, 
      course: req.body.course,
      semester: req.body.semester
    });
    if (existing && req.body.subjectCode) {
      return res.status(400).json({ error: 'Subject with this code already exists in this course and semester.' });
    }
    const subject = new Subject(req.body);
    await subject.save();
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    // Also delete associated allotments
    await SubjectAllotment.deleteMany({ subjectId: req.params.id });
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkUpload = async (req, res) => {
  try {
    const subjects = req.body.subjects; // Array of subjects from frontend
    const strategy = req.body.strategy || 'skip'; // 'skip' or 'overwrite'
    
    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (const sub of subjects) {
      try {
        if (!sub.name || !sub.course || !sub.semester || !sub.department || !sub.academicYear) {
          skipped++;
          errors.push(`Row missing required fields (Name, Course, Semester, Department, AY). Data: ${sub.name}`);
          continue;
        }

        const existing = await Subject.findOne({ 
          subjectCode: sub.subjectCode,
          course: sub.course,
          semester: sub.semester 
        });

        if (existing) {
          if (strategy === 'overwrite') {
            await Subject.findByIdAndUpdate(existing._id, sub);
            imported++;
          } else {
            skipped++;
          }
        } else {
          const newSub = new Subject(sub);
          await newSub.save();
          imported++;
        }
      } catch (err) {
        skipped++;
        errors.push(`Error saving subject ${sub.name || sub.subjectCode}: ${err.message}`);
      }
    }

    res.json({ message: 'Bulk upload completed', imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllotments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.course) filter.course = req.query.course;
    if (req.query.semester) filter.semester = req.query.semester;
    if (req.query.division) filter.division = req.query.division;
    
    const allotments = await SubjectAllotment.find(filter).populate('subjectId facultyId').sort({ createdAt: -1 });
    res.json(allotments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAllotment = async (req, res) => {
  try {
    const { subjectIds, facultyIds, academicYear, department, course, branch, semester, division } = req.body;
    
    if (!subjectIds || !facultyIds || subjectIds.length === 0 || facultyIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one subject and one faculty.' });
    }

    const newAllotments = [];
    
    for (const subjectId of subjectIds) {
      for (const facultyId of facultyIds) {
        // Avoid exact duplicates
        const exists = await SubjectAllotment.findOne({
          subjectId,
          facultyId,
          academicYear,
          department,
          course,
          semester,
          division
        });
        
        if (!exists) {
          const sub = await Subject.findById(subjectId);
          const fac = await Faculty.findById(facultyId);
          
          const allotment = new SubjectAllotment({
            subjectId,
            subjectName: sub ? sub.name : '',
            facultyId,
            facultyName: fac ? fac.name : '',
            academicYear,
            department,
            course,
            branch,
            semester,
            division,
            assignedBy: req.user ? req.user.id : 'Admin'
          });
          await allotment.save();
          newAllotments.push(allotment);
        }
      }
    }
    
    res.status(201).json({ message: 'Allotments created successfully', allotments: newAllotments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAllotment = async (req, res) => {
  try {
    const allotment = await SubjectAllotment.findByIdAndDelete(req.params.id);
    if (!allotment) return res.status(404).json({ error: 'Allotment not found' });
    res.json({ message: 'Allotment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
