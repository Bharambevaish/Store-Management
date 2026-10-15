const StudentPromotion = require('../models/studentPromotion');
const Student = require('../models/student');
const AuditLog = require('../models/auditLog');
const mongoose = require('mongoose');
const StudentAttendance = require('../models/studentAttendance');
const PassingRemark = require('../models/passingRemark');
const Notification = require('../models/notification');

exports.bulkPromote = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const { 
      studentIds, 
      targetAcademicYear, 
      targetSemester, 
      targetDivision, 
      targetSection, 
      targetBatch, 
      promotionStatus, 
      remarks, 
      promotionDate,
      feeStructure,
      syncModules
    } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'No students selected for promotion.' });
    }

    if (!promotionStatus && !syncModules && !feeStructure) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Action required: promotion status, module sync, or fee allotment.' });
    }

    // Identify user performing action
    const performedBy = req.user ? req.user.name || req.user.id : 'System Admin';
    const userRole = req.user ? req.user.role : 'admin';

    // Fetch the students we are about to modify
    const students = await Student.find({ _id: { $in: studentIds } }).session(session);

    const promotionRecords = [];
    const auditLogs = [];
    const bulkStudentOps = [];
    const bulkAttendanceOps = [];
    const bulkPassingOps = [];

    students.forEach(student => {
      const prevAcademicYear = student.academicYear;
      const prevSemester = student.semester;
      const prevDivision = student.division;
      const prevSection = student.section;
      const prevBatch = student.batch;
      const prevStatus = student.studentStatus;

      // Logic for new values
      const newAcademicYear = targetAcademicYear || prevAcademicYear;
      const newSemester = targetSemester || prevSemester;
      const newDivision = targetDivision || prevDivision;
      const newSection = targetSection || prevSection;
      const newBatch = targetBatch || prevBatch;
      
      let newStudentStatus = prevStatus;
      if (promotionStatus) {
        newStudentStatus = 'Active';
        if (promotionStatus === 'Alumni') newStudentStatus = 'Alumni';
        if (promotionStatus === 'Dropout' || promotionStatus === 'Detain') newStudentStatus = 'Dropped';
        
        // Skip duplicate or inactive promotion if it's purely a promotion operation
        if (prevStatus === 'Alumni' || prevStatus === 'Inactive' || prevStatus === 'Dropped') {
          // Can still do fee/sync ops if needed, but not promotion history
        } else if (!(newSemester === prevSemester && newAcademicYear === prevAcademicYear && promotionStatus === 'Promote')) {
          // Prepare Promotion History Record
          promotionRecords.push({
            studentId: student._id,
            prevAcademicYear,
            prevSemester,
            prevDivision,
            prevSection,
            newAcademicYear,
            newSemester,
            newDivision,
            newSection,
            promotionDate: promotionDate || new Date(),
            performedBy,
            status: promotionStatus,
            remarks
          });

          auditLogs.push({
            action: 'Student Promotion',
            user: performedBy,
            role: userRole,
            studentId: student._id,
            previousValues: { academicYear: prevAcademicYear, semester: prevSemester, division: prevDivision, section: prevSection, studentStatus: prevStatus },
            newValues: { academicYear: newAcademicYear, semester: newSemester, division: newDivision, section: newSection, studentStatus: newStudentStatus }
          });
        }
      }

      // Sync Modules
      const syncKeys = syncModules ? Object.keys(syncModules).filter(k => syncModules[k]) : [];
      
      if (syncKeys.includes('Attendance Management')) {
        bulkAttendanceOps.push({
          updateOne: {
            filter: { studentId: student._id, date: { $gte: new Date(new Date().setHours(0,0,0,0)) } },
            update: { $setOnInsert: { studentId: student._id, date: new Date(), status: 'Present', remarks: 'Auto-synced via promotion' } },
            upsert: true
          }
        });
      }

      if (syncKeys.includes('Result Analysis')) {
        bulkPassingOps.push({
          updateOne: {
            filter: { studentId: student._id, effectiveAcademicYear: newAcademicYear },
            update: { $setOnInsert: { studentId: student._id, passingRemark: 'Promoted', effectiveAcademicYear: newAcademicYear, remarkBy: performedBy } },
            upsert: true
          }
        });
      }

      // Prepare Student update op
      bulkStudentOps.push({
        updateOne: {
          filter: { _id: student._id },
          update: {
            $set: {
              ...(promotionStatus && {
                academicYear: newAcademicYear,
                semester: newSemester,
                division: newDivision,
                section: newSection,
                batch: newBatch,
                studentStatus: newStudentStatus
              }),
              ...(feeStructure && { feeStructure }),
              ...(syncKeys.length > 0 && { synchronizedModules: syncKeys })
            }
          }
        }
      });
    });

    if (bulkStudentOps.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'No valid students found to process.' });
    }

    // Execute all in parallel within transaction
    if (promotionRecords.length > 0) await StudentPromotion.insertMany(promotionRecords, { session });
    if (auditLogs.length > 0) await AuditLog.insertMany(auditLogs, { session });
    if (bulkStudentOps.length > 0) await Student.bulkWrite(bulkStudentOps, { session });
    if (bulkAttendanceOps.length > 0) await StudentAttendance.bulkWrite(bulkAttendanceOps, { session });
    if (bulkPassingOps.length > 0) await PassingRemark.bulkWrite(bulkPassingOps, { session });
    
    // Notification logic
    const syncKeysGlobal = syncModules ? Object.keys(syncModules).filter(k => syncModules[k]) : [];
    if (syncKeysGlobal.includes('Notification System')) {
       await Notification.create([{
         title: 'Student Data Synchronized',
         message: `System synchronized ${students.length} student records for term ${targetAcademicYear || 'Current'}`,
         sender: performedBy,
         recipientRole: 'Faculty',
         type: 'broadcast'
       }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: `Successfully processed ${studentIds.length} student(s) - Status: ${promotionStatus || 'Update Only'}` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in bulkPromote:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPromotionHistory = async (req, res) => {
  try {
    const studentIdParam = req.params.studentId;
    let filter = {};
    if (studentIdParam.length === 24) {
      filter.studentId = studentIdParam;
    } else {
      const student = await Student.findOne({ studentId: studentIdParam });
      if (!student) return res.status(404).json({ error: 'Student not found' });
      filter.studentId = student._id;
    }
    const history = await StudentPromotion.find(filter).sort({ promotionDate: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

exports.promoteIndividual = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    // same bulk promote logic but for one student
    req.body.studentIds = [studentId];
    await exports.bulkPromote(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to promote student' });
  }
};
