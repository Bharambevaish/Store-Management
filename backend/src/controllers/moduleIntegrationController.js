const Student = require('../models/student');

const getModuleProjection = (moduleName) => {
  // Common fields that almost every module needs
  const common = 'studentId rollNumber firstName lastName course semester studentStatus';
  
  switch (moduleName) {
    case 'Fee Collection System':
      return `${common} admissionNumber department feeCategory scholarshipApplicable scholarshipName scholarshipAmount totalFee paidAmount pendingAmount email mobile`;
    case 'Attendance Management':
      return `${common} division section batch academicYear`;
    case 'Teacher Guardian':
      return `${common} parentDetails academicYear email mobile currentAddress classTeacher mentor`;
    case 'Result Analysis':
    case 'Passing Remarks':
    case 'Academic Register':
      return `${common} passingRemark effectiveAcademicYear remarkDate department batch division section`;
    case 'Student Portal':
      return `${common} dob email mobile currentAddress studentEmailLogin accountStatus documents`;
    case 'Student Documents':
    case 'Document Verification':
      return `${common} documents`;
    case 'Certificates':
      return `${common} dob admissionDate department academicYear passingYear previousSchool previousBoard`;
    case 'Identity Card':
    case 'Railway Concession':
    case 'Hall Ticket':
      return `${common} dob bloodGroup currentAddress mobile photo`;
    default:
      // Fallback projection for modules not explicitly configured
      return `${common}`;
  }
};

exports.getStudentsForModule = async (req, res) => {
  try {
    const { moduleName } = req.params;
    if (!moduleName) return res.status(400).json({ error: 'Module name is required' });

    const projection = getModuleProjection(moduleName);

    // Fetch students that have this module in their synchronizedModules array
    const students = await Student.find({ synchronizedModules: moduleName })
                                  .select(projection)
                                  .lean();

    res.json(students);
  } catch (err) {
    console.error('Error in getStudentsForModule:', err);
    res.status(500).json({ error: 'Failed to fetch students for this module' });
  }
};
