const DocumentSetup = require('../models/documentSetup');
const DocumentSetting = require('../models/documentSetting');
const DocumentAuthority = require('../models/documentAuthority');
const ApprovalPath = require('../models/approvalPath');
const DocumentTemplate = require('../models/documentTemplate');
const DocumentRegister = require('../models/documentRegister');

// ==================== DOCUMENT SETUP ====================
exports.getSetups = async (req, res) => {
  try {
    const docs = await DocumentSetup.find().sort({ displayOrder: 1, documentTitle: 1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addSetup = async (req, res) => {
  try {
    const doc = new DocumentSetup(req.body);
    await doc.save();
    res.status(201).json({ message: 'Document Setup created', data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSetup = async (req, res) => {
  try {
    const updated = await DocumentSetup.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Document Setup updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSetup = async (req, res) => {
  try {
    await DocumentSetup.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document Setup deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENT SETTINGS ====================
exports.getSettings = async (req, res) => {
  try {
    let setting = await DocumentSetting.findOne();
    if (!setting) {
      setting = await DocumentSetting.create({}); // Returns defaults
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let setting = await DocumentSetting.findOne();
    if (!setting) {
      setting = new DocumentSetting(req.body);
      await setting.save();
    } else {
      Object.assign(setting, req.body);
      await setting.save();
    }
    res.json({ message: 'Settings updated', data: setting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENT AUTHORITIES ====================
exports.getAuthorities = async (req, res) => {
  try {
    const auths = await DocumentAuthority.find().sort({ authorityName: 1 });
    res.json(auths);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addAuthority = async (req, res) => {
  try {
    const auth = new DocumentAuthority(req.body);
    await auth.save();
    res.status(201).json({ message: 'Authority created', data: auth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateAuthority = async (req, res) => {
  try {
    const updated = await DocumentAuthority.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Authority updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAuthority = async (req, res) => {
  try {
    await DocumentAuthority.findByIdAndDelete(req.params.id);
    res.json({ message: 'Authority deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== APPROVAL PATHS ====================
exports.getApprovalPaths = async (req, res) => {
  try {
    const paths = await ApprovalPath.find().populate('steps.authorityId');
    res.json(paths);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addApprovalPath = async (req, res) => {
  try {
    const path = new ApprovalPath(req.body);
    await path.save();
    res.status(201).json({ message: 'Approval Path created', data: path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateApprovalPath = async (req, res) => {
  try {
    const updated = await ApprovalPath.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('steps.authorityId');
    res.json({ message: 'Approval Path updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteApprovalPath = async (req, res) => {
  try {
    await ApprovalPath.findByIdAndDelete(req.params.id);
    res.json({ message: 'Approval Path deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENT TEMPLATES ====================
exports.getTemplates = async (req, res) => {
  try {
    const temps = await DocumentTemplate.find();
    res.json(temps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTemplate = async (req, res) => {
  try {
    const temp = new DocumentTemplate(req.body);
    await temp.save();
    res.status(201).json({ message: 'Template created', data: temp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const updated = await DocumentTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Template updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await DocumentTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DOCUMENT REGISTER & DIRECT GENERATE ====================
exports.getRegisters = async (req, res) => {
  try {
    const regs = await DocumentRegister.find().sort({ date: -1 });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addRegister = async (req, res) => {
  try {
    const reg = new DocumentRegister(req.body);
    await reg.save();
    res.status(201).json({ message: 'Document generated and added to register', data: reg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== GENERIC DOCUMENTS ====================
const Document = require('../models/document');
exports.getAllDocuments = async (req, res) => {
  try {
    const query = {};
    if (req.query.studentId) query.studentId = req.query.studentId;
    if (req.query.documentType) query.documentType = req.query.documentType;
    if (req.query.status) query.verificationStatus = req.query.status;

    const docs = await Document.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: 'studentId',
          as: 'studentInfo'
        }
      },
      {
        $unwind: {
          path: '$studentInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          rollNumber: '$studentInfo.rollNumber',
          admissionNumber: '$studentInfo.studentId',
          course: '$studentInfo.course',
          semester: '$studentInfo.semester'
        }
      },
      {
        $project: { studentInfo: 0 }
      },
      { $sort: { createdAt: -1 } }
    ]);
    
    let finalDocs = docs;
    if (req.query.course) {
      finalDocs = finalDocs.filter(d => d.course === req.query.course);
    }
    if (req.query.semester) {
      finalDocs = finalDocs.filter(d => d.semester === req.query.semester);
    }

    res.json(finalDocs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const Student = require('../models/student');
    const DocumentSetup = require('../models/documentSetup');
    
    let studentObj = null;
    if (req.body.studentId) {
      studentObj = await Student.findOne({ studentId: req.body.studentId });
    }
    
    let category = 'General';
    if (req.body.documentSetupId && req.body.documentSetupId !== 'undefined' && req.body.documentSetupId.length === 24) {
      const setup = await DocumentSetup.findById(req.body.documentSetupId);
      if (setup) category = setup.category || 'General';
    }

    const doc = new Document({
      ...req.body,
      studentObjectId: studentObj ? studentObj._id : null,
      studentName: studentObj ? `${studentObj.firstName} ${studentObj.lastName}` : (req.body.studentName || 'Unknown'),
      category: category,
      originalFileName: req.body.fileName,
      status: 'Pending Verification',
      verificationStatus: 'Pending Verification',
      uploadedBy: req.user?.id || 'Admin'
    });
    
    await doc.save();
    res.status(201).json({ message: 'Document uploaded', data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const doc = await Document.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      status: status,
      remarks: remarks || '',
      verifiedBy: req.user?.id || 'Admin',
      verifiedDate: new Date()
    }, { new: true });
    res.json({ message: 'Verification status updated', data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
