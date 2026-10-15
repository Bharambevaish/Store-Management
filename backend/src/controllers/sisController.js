const Student = require('../models/student');
const Faculty = require('../models/faculty');
const Course = require('../models/course');
const Subject = require('../models/subject');
const Admission = require('../models/admission');
const Certificate = require('../models/certificate');
const Application = require('../models/application');
const Notification = require('../models/notification');
const Calendar = require('../models/calendar');
const Document = require('../models/document');
const DocumentSetup = require('../models/documentSetup');
const Settings = require('../models/settings');
const InstituteProfile = require('../models/institute');
const DocumentInOut = require('../models/docInOut');
const User = require('../models/user');

// Helper to validate phone and email
const validateMobile = (v) => /^[0-9]{10}$/.test(v);
const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ==================== DASHBOARD STATS ====================

exports.getAdminDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: 'Active' });
    const inactiveStudents = await Student.countDocuments({ status: 'Inactive' });
    const totalFaculty = await Faculty.countDocuments();
    const totalCourses = await Course.countDocuments();

    // Today's Admissions
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayAdmissions = await Admission.countDocuments({
      createdAt: { $gte: startOfToday },
      status: 'Approved'
    });

    const pendingApplications = await Application.countDocuments({ status: 'Pending' });
    const certificatesIssued = await Certificate.countDocuments({ status: 'Issued' });

    // Recent notifications
    const recentNotifications = await Notification.find().sort({ createdAt: -1 }).limit(5);

    // Recent activities (mocked from various logs)
    const recentAdmissions = await Student.find().sort({ admissionDate: -1 }).limit(5);

    // Upcoming birthdays (within 30 days, or just sorting by month/day)
    // To make it easy, get all students and find those born today or upcoming
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDate = today.getDate();
    const students = await Student.find({}, 'firstName lastName dob course rollNumber');
    const upcomingBirthdays = students.filter(s => {
      if (!s.dob) return false;
      const m = s.dob.getMonth() + 1;
      const d = s.dob.getDate();
      return m === currentMonth && d >= currentDate && d <= currentDate + 7;
    }).slice(0, 5);

    // Chart Data calculations:
    // 1. Student Growth by Year (count by admissionDate)
    const growthStats = await Student.aggregate([
      {
        $group: {
          _id: { $year: '$admissionDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const studentGrowth = growthStats.map(item => ({ year: item._id || 2026, count: item.count }));

    // 2. Gender Distribution
    const genderStats = await Student.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);
    const genderDistribution = genderStats.map(item => ({ gender: item._id, count: item.count }));

    // 3. Course-wise Students
    const courseStats = await Student.aggregate([
      {
        $group: {
          _id: '$course',
          count: { $sum: 1 }
        }
      }
    ]);
    const courseWiseStudents = courseStats.map(item => ({ course: item._id, count: item.count }));

    // 4. Monthly Admissions (this year)
    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const monthlyStats = await Student.aggregate([
      { $match: { admissionDate: { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: '$admissionDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyAdmissions = Array.from({ length: 12 }, (_, i) => ({ month: monthNames[i], count: 0 }));
    monthlyStats.forEach(item => {
      if (item._id >= 1 && item._id <= 12) {
        monthlyAdmissions[item._id - 1].count = item.count;
      }
    });

    res.json({
      metrics: {
        totalStudents,
        activeStudents,
        inactiveStudents,
        totalFaculty,
        totalCourses,
        todayAdmissions,
        pendingApplications,
        certificatesIssued
      },
      recentNotifications,
      recentAdmissions,
      upcomingBirthdays,
      charts: {
        studentGrowth: studentGrowth.length ? studentGrowth : [{ year: 2026, count: totalStudents }],
        genderDistribution,
        courseWiseStudents,
        monthlyAdmissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFacultyDashboardStats = async (req, res) => {
  try {
    const facultyEmail = req.user ? req.user.email : '';
    // Find faculty department
    const faculty = await Faculty.findOne({ email: facultyEmail });
    const dept = faculty ? faculty.department : '';

    // Students in this faculty's department
    const myStudents = dept 
      ? await Student.countDocuments({ department: dept })
      : await Student.countDocuments();

    // Mock/General attendance stats
    const todayAttendance = { present: Math.round(myStudents * 0.9), absent: Math.round(myStudents * 0.1) };
    const pendingApplications = await Application.countDocuments({ status: 'Pending' });
    const certificatesPending = await Application.countDocuments({ type: { $regex: /Certificate/i }, status: 'Pending' });

    // Recent notifications
    const recentNotifications = await Notification.find({ recipientRole: { $in: ['All', 'Faculty'] } })
      .sort({ createdAt: -1 }).limit(5);

    // Subject-wise student distribution for subjects taught in department
    const courseStats = await Student.aggregate([
      { $match: dept ? { department: dept } : {} },
      {
        $group: {
          _id: '$course',
          count: { $sum: 1 }
        }
      }
    ]);
    const subjectWiseStudents = courseStats.map(item => ({ subject: item._id, count: item.count }));

    // Mock charts for performance and attendance
    const studentPerformance = [
      { grade: 'A+', count: Math.round(myStudents * 0.15) || 5 },
      { grade: 'A', count: Math.round(myStudents * 0.3) || 10 },
      { grade: 'B', count: Math.round(myStudents * 0.35) || 12 },
      { grade: 'C', count: Math.round(myStudents * 0.15) || 5 },
      { grade: 'D/F', count: Math.round(myStudents * 0.05) || 2 }
    ];

    const attendanceOverview = [
      { week: 'W1', rate: 92 },
      { week: 'W2', rate: 94 },
      { week: 'W3', rate: 89 },
      { week: 'W4', rate: 91 }
    ];

    res.json({
      metrics: {
        myStudents,
        todayAttendance: `${todayAttendance.present}/${myStudents}`,
        pendingApplications,
        certificatesPending
      },
      recentNotifications,
      charts: {
        studentPerformance,
        attendanceOverview,
        subjectWiseStudents
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== STUDENT MODULE ====================

exports.addStudent = async (req, res) => {
  try {
    const studentData = req.body;
    
    // Validations
    if (!studentData.studentId || !studentData.rollNumber || !studentData.firstName || !studentData.lastName || !studentData.dob || !studentData.gender || !studentData.mobile || !studentData.email || !studentData.address || !studentData.course || !studentData.department || !studentData.semester) {
      return res.status(400).json({ error: 'All primary student fields are required' });
    }

    if (!validateMobile(studentData.mobile)) {
      return res.status(400).json({ error: 'Student mobile must be exactly 10 digits' });
    }

    if (!validateEmail(studentData.email)) {
      return res.status(400).json({ error: 'Invalid student email format' });
    }

    if (studentData.parentDetails) {
      if (!studentData.parentDetails.fatherName || !studentData.parentDetails.motherName || !studentData.parentDetails.parentMobile) {
        return res.status(400).json({ error: 'All parent fields (father, mother, mobile) are required' });
      }
      if (!validateMobile(studentData.parentDetails.parentMobile)) {
        return res.status(400).json({ error: 'Parent mobile must be exactly 10 digits' });
      }
    }

    const existingStudent = await Student.findOne({ studentId: studentData.studentId });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student ID already exists' });
    }

    const student = new Student(studentData);
    await student.save();
    res.status(201).json({ message: 'Student added successfully', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const studentData = req.body;

    if (studentData.mobile && !validateMobile(studentData.mobile)) {
      return res.status(400).json({ error: 'Student mobile must be exactly 10 digits' });
    }

    if (studentData.email && !validateEmail(studentData.email)) {
      return res.status(400).json({ error: 'Invalid student email format' });
    }

    if (studentData.parentDetails && studentData.parentDetails.parentMobile) {
      if (!validateMobile(studentData.parentDetails.parentMobile)) {
        return res.status(400).json({ error: 'Parent mobile must be exactly 10 digits' });
      }
    }

    const student = await Student.findByIdAndUpdate(id, studentData, { new: true, runValidators: true });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student updated successfully', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', course = '', department = '', semester = '', status = '' } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { studentId: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (course) query.course = course;
    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (status) query.status = status;

    const count = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ rollNumber: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      students,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalStudents: count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    let student = null;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      student = await Student.findById(id);
    }
    
    if (!student) {
      student = await Student.findOne({ 
        $or: [
          { studentId: id }, 
          { rollNumber: id }
        ] 
      });
    }
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== FACULTY MODULE ====================

exports.addFaculty = async (req, res) => {
  try {
    const facultyData = req.body;
    
    if (!facultyData.facultyId || !facultyData.name || !facultyData.mobile || !facultyData.email || !facultyData.department || !facultyData.qualification || !facultyData.experience) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validateMobile(facultyData.mobile)) {
      return res.status(400).json({ error: 'Mobile must be exactly 10 digits' });
    }

    if (!validateEmail(facultyData.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingFaculty = await Faculty.findOne({ facultyId: facultyData.facultyId });
    if (existingFaculty) {
      return res.status(400).json({ error: 'Faculty ID already exists' });
    }

    // Auto-create a linked user account for this faculty if they don't have one
    const existingUser = await User.findOne({ email: facultyData.email });
    let linkedUser = existingUser;
    if (!existingUser) {
      linkedUser = new User({
        email: facultyData.email,
        password: 'faculty@123', // default password
        role: 'faculty',
        name: facultyData.name,
        status: 'Active'
      });
      await linkedUser.save();
    }

    facultyData.userId = linkedUser._id;
    const faculty = new Faculty(facultyData);
    await faculty.save();

    res.status(201).json({ message: 'Faculty added successfully, login credentials created (default password: faculty@123)', faculty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const facultyData = req.body;

    if (facultyData.mobile && !validateMobile(facultyData.mobile)) {
      return res.status(400).json({ error: 'Mobile must be exactly 10 digits' });
    }

    if (facultyData.email && !validateEmail(facultyData.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const faculty = await Faculty.findByIdAndUpdate(id, facultyData, { new: true });
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    res.json({ message: 'Faculty updated successfully', faculty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    // Delete linked user if any
    if (faculty.userId) {
      await User.findByIdAndDelete(faculty.userId);
    }

    await Faculty.findByIdAndDelete(id);
    res.json({ message: 'Faculty deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFaculty = async (req, res) => {
  try {
    const { search = '', department = '' } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { facultyId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (department) query.department = department;

    const facultyList = await Faculty.find(query).sort({ facultyId: 1 });
    res.json(facultyList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    let faculty = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      faculty = await Faculty.findById(id);
    }
    if (!faculty) {
      faculty = await Faculty.findOne({ facultyId: id });
    }
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    res.json(faculty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== COURSE MODULE ====================

exports.addCourse = async (req, res) => {
  try {
    const { courseId, name, department, duration } = req.body;
    if (!courseId || !name || !department || !duration) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await Course.findOne({ courseId });
    if (existing) {
      return res.status(400).json({ error: 'Course ID already exists' });
    }

    const course = new Course({ courseId, name, department, duration });
    await course.save();

    // Auto update Settings lists
    await Settings.updateOne(
      { key: 'global' },
      { $addToSet: { courses: `${courseId} - ${name}`, departments: department } },
      { upsert: true }
    );

    res.status(201).json({ message: 'Course created successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByIdAndUpdate(id, req.body, { new: true });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course updated successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByIdAndDelete(id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { courseId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    const courses = await Course.find(query).sort({ courseId: 1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== SUBJECT MODULE ====================

exports.addSubject = async (req, res) => {
  try {
    const {
      admissionYear, academicYear, courseCode, courseName, classId, semester,
      name, credits, group, isCore, subjectCode, subjectId, subjectType,
      selectionCount, totalMarks, passingMarks, gradeOfFailure, faculty
    } = req.body;

    if (!subjectId || !name) {
      return res.status(400).json({ error: 'Subject ID and Subject Name are required' });
    }

    const existing = await Subject.findOne({ subjectId });
    if (existing) {
      return res.status(400).json({ error: 'Subject ID already exists' });
    }

    const subject = new Subject({
      admissionYear, academicYear, courseCode, courseName, classId, semester,
      name, credits, group, isCore, subjectCode, subjectId, subjectType,
      selectionCount, totalMarks, passingMarks, gradeOfFailure, faculty
    });
    
    await subject.save();
    res.status(201).json({ message: 'Subject created successfully', subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAllSubjects = async (req, res) => {
  try {
    await Subject.deleteMany({});
    res.json({ message: 'All subjects deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndUpdate(id, req.body, { new: true });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject updated successfully', subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndDelete(id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ subjectId: 1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== ADMISSIONS ====================

exports.submitAdmissionForm = async (req, res) => {
  try {
    const details = req.body;
    if (!details.firstName || !details.lastName || !details.dob || !details.gender || !details.mobile || !details.email || !details.address || !details.course || !details.department || !details.semester) {
      return res.status(400).json({ error: 'Missing required admission form fields' });
    }

    const count = await Admission.countDocuments();
    const formNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const admission = new Admission({
      formNumber,
      studentDetails: details,
      status: 'Pending'
    });
    await admission.save();

    res.status(201).json({ message: 'Admission application submitted successfully', formNumber, admission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processAdmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // Approved or Rejected

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid admission approval status' });
    }

    const admission = await Admission.findById(id);
    if (!admission) {
      return res.status(404).json({ error: 'Admission application not found' });
    }

    admission.status = status;
    admission.remarks = remarks || '';
    await admission.save();

    // If approved, create the actual Student record
    if (status === 'Approved') {
      const studentCount = await Student.countDocuments();
      const studentId = `STU${new Date().getFullYear()}${String(studentCount + 1).padStart(4, '0')}`;
      const rollNumber = `R${new Date().getFullYear()}${String(studentCount + 1).padStart(3, '0')}`;

      const student = new Student({
        studentId,
        rollNumber,
        firstName: admission.studentDetails.firstName,
        lastName: admission.studentDetails.lastName,
        dob: admission.studentDetails.dob,
        gender: admission.studentDetails.gender,
        mobile: admission.studentDetails.mobile,
        email: admission.studentDetails.email,
        address: admission.studentDetails.address,
        parentDetails: admission.studentDetails.parentDetails,
        course: admission.studentDetails.course,
        department: admission.studentDetails.department,
        semester: admission.studentDetails.semester,
        photo: admission.studentDetails.photo,
        status: 'Active'
      });
      await student.save();
    }

    res.json({ message: `Admission application has been ${status}`, admission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdmissions = async (req, res) => {
  try {
    const admissions = await Admission.find().sort({ createdAt: -1 });
    res.json(admissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== CERTIFICATES ====================

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId, type, reason } = req.body;
    if (!studentId || !type) {
      return res.status(400).json({ error: 'Student ID and Certificate Type (Leaving or Bonafide) are required' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const count = await Certificate.countDocuments({ type });
    const code = type === 'Leaving' ? 'LC' : 'BC';
    const serialNumber = `${code}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const certificateId = `CERT-${code}-${Date.now()}`;

    const cert = new Certificate({
      certificateId,
      type,
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      serialNumber,
      reason: reason || 'Academic completion',
      status: 'Issued'
    });
    await cert.save();

    res.status(201).json({ message: 'Certificate generated successfully', certificate: cert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCertificates = async (req, res) => {
  try {
    const { type } = req.query;
    const query = {};
    if (type) query.type = type;

    const certs = await Certificate.find(query).sort({ issueDate: -1 });
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== APPLICATIONS ====================

exports.submitApplication = async (req, res) => {
  try {
    const { studentId, type, details } = req.body;
    if (!studentId || !type) {
      return res.status(400).json({ error: 'Student ID and Application Type are required' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const count = await Application.countDocuments();
    const applicationId = `APP-${Date.now()}-${count + 1}`;

    const app = new Application({
      applicationId,
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      type,
      details,
      status: 'Pending'
    });
    await app.save();

    res.status(201).json({ message: 'Application submitted successfully', application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const app = await Application.findById(id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    app.status = status;
    app.remarks = remarks || '';
    await app.save();

    res.json({ message: `Application status updated to ${status}`, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== NOTIFICATIONS ====================

exports.sendNotification = async (req, res) => {
  try {
    const { title, message, recipientRole } = req.body;
    const sender = req.user ? req.user.name : 'Administrator';

    if (!title || !message) {
      return res.status(400).json({ error: 'Notification title and message are required' });
    }

    const notif = new Notification({
      title,
      message,
      sender,
      recipientRole: recipientRole || 'All'
    });
    await notif.save();

    res.status(201).json({ message: 'Notification sent successfully', notification: notif });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find().sort({ createdAt: -1 });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== ACADEMIC CALENDAR ====================

exports.addCalendarEvent = async (req, res) => {
  try {
    const { title, description, type, startDate, endDate } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, Start Date, and End Date are required' });
    }

    const event = new Calendar({ title, description, type, startDate, endDate });
    await event.save();
    res.status(201).json({ message: 'Calendar event added', event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Calendar.findByIdAndUpdate(id, req.body, { new: true });
    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    res.json({ message: 'Calendar event updated', event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Calendar.findByIdAndDelete(id);
    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    res.json({ message: 'Calendar event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const events = await Calendar.find().sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENTS ====================

exports.uploadDocument = async (req, res) => {
  try {
    const { studentId, documentType, fileName, fileContent } = req.body;
    if (!studentId || !documentType || !fileName || !fileContent) {
      return res.status(400).json({ error: 'All upload parameters (studentId, documentType, fileName, fileContent) are required' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const doc = new Document({
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      documentType,
      fileName,
      fileContent,
      status: 'Pending'
    });
    await doc.save();

    res.status(201).json({ message: 'Document uploaded successfully', document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const { studentId } = req.query;
    const query = {};
    if (studentId) query.studentId = studentId;

    const docs = await Document.find(query).sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid document approval status' });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    doc.status = status;
    await doc.save();

    res.json({ message: `Document status updated to ${status}`, document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENTS INWARD/OUTWARD ====================

exports.logDocInOut = async (req, res) => {
  try {
    const { studentId, documentName, direction, status, remarks } = req.body;
    if (!studentId || !documentName || !direction) {
      return res.status(400).json({ error: 'Student ID, Document Name, and In/Out direction are required' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const log = new DocumentInOut({
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      documentName,
      direction,
      status: status || 'Pending',
      remarks: remarks || ''
    });
    await log.save();

    res.status(201).json({ message: 'Document movement logged successfully', log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDocInOutLogs = async (req, res) => {
  try {
    const logs = await DocumentInOut.find().sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDocInOutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const log = await DocumentInOut.findById(id);
    if (!log) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    if (status) log.status = status;
    if (remarks !== undefined) log.remarks = remarks;
    await log.save();

    res.json({ message: 'Log entry updated successfully', log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== SETTINGS & PROFILE ====================

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { ...req.body, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    res.json({ message: 'Settings updated successfully', settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInstituteProfile = async (req, res) => {
  try {
    let profile = await InstituteProfile.findOne({ key: 'profile' });
    if (!profile) {
      profile = new InstituteProfile({ key: 'profile' });
      await profile.save();
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateInstituteProfile = async (req, res) => {
  try {
    const profile = await InstituteProfile.findOneAndUpdate(
      { key: 'profile' },
      { ...req.body, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    res.json({ message: 'Institute profile updated successfully', profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PROMOTIONS & ROLL CALL ====================

exports.promoteStudents = async (req, res) => {
  try {
    const { fromCourse, fromSemester, toSemester, studentIds } = req.body;
    if (!fromCourse || !fromSemester || !toSemester || !studentIds || !studentIds.length) {
      return res.status(400).json({ error: 'Missing required parameters for student promotion' });
    }

    const result = await Student.updateMany(
      { studentId: { $in: studentIds }, course: fromCourse, semester: fromSemester },
      { $set: { semester: toSemester } }
    );

    res.json({
      message: `Promoted ${result.modifiedCount} student(s) from semester ${fromSemester} to ${toSemester}`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRollCall = async (req, res) => {
  try {
    const { course, semester } = req.query;
    if (!course || !semester) {
      return res.status(400).json({ error: 'Course and Semester are required to generate roll call' });
    }

    // The frontend sends the courseId (e.g. "BTECH-CE"), but students store course name.
    // Try to resolve by looking up the Course model first.
    let courseFilter;
    try {
      const Course = require('../models/course');
      const courseDoc = await Course.findOne({ courseId: course });
      if (courseDoc) {
        // Match by name (stored in student.course)
        courseFilter = { $or: [{ course: courseDoc.name }, { course }] };
      } else {
        courseFilter = { $or: [{ course }] };
      }
    } catch {
      courseFilter = { course };
    }

    // Semester can be stored as "1" or "Semester 1" - match both
    const semesterFilter = { $or: [{ semester }, { semester: `Semester ${semester}` }] };

    const students = await Student.find({
      ...courseFilter,
      ...semesterFilter,
      status: 'Active'
    })
      .sort({ rollNumber: 1 })
      .select('studentId rollNumber firstName lastName gender email mobile');

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENT SETUP ====================

exports.addDocumentSetup = async (req, res) => {
  try {
    const newDocSetup = new DocumentSetup(req.body);
    await newDocSetup.save();
    res.status(201).json({ message: 'Document Setup created successfully', documentSetup: newDocSetup });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Document Title must be unique' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.editDocumentSetup = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await DocumentSetup.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Document setup not found' });
    res.json({ message: 'Document Setup updated successfully', documentSetup: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDocumentSetup = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await DocumentSetup.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Document setup not found' });
    res.json({ message: 'Document Setup deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDocumentSetups = async (req, res) => {
  try {
    const docs = await DocumentSetup.find().sort({ displayOrder: 1, documentTitle: 1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    doc.status = status;
    doc.verificationStatus = status;
    if (remarks) doc.remarks = remarks;
    doc.verifiedBy = req.ctx ? req.ctx.username : 'Admin';
    doc.verifiedDate = new Date();
    
    await doc.save();
    res.json({ message: `Document ${status}`, document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudentDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Document.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
