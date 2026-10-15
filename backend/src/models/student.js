const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // Tab 1: Personal
  studentId: { type: String, required: true, unique: true, trim: true },
  admissionNumber: { type: String, trim: true },
  rollNumber: { type: String, required: true, trim: true },
  enrollmentNumber: { type: String, trim: true },
  prn: { type: String, trim: true },
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  bloodGroup: { type: String, trim: true },
  category: { type: String, trim: true },
  religion: { type: String, trim: true },
  caste: { type: String, trim: true },
  subCaste: { type: String, trim: true },
  nationality: { type: String, trim: true },
  aadhaarNumber: { type: String, trim: true },
  panNumber: { type: String, trim: true },
  passportNumber: { type: String, trim: true },
  birthPlace: { type: String, trim: true },
  motherTongue: { type: String, trim: true },
  maritalStatus: { type: String, trim: true },
  studentStatus: { type: String, enum: ['Active', 'Inactive', 'Alumni', 'Dropped'], default: 'Active' },
  photo: { type: String },

  // Tab 2: Contact
  mobile: { type: String, required: true },
  alternateMobile: { type: String, trim: true },
  email: { type: String, required: true },
  alternateEmail: { type: String, trim: true },
  currentAddress: { type: String, required: true }, // mapped from old address
  permanentAddress: { type: String, trim: true },
  city: { type: String, trim: true },
  taluka: { type: String, trim: true },
  district: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true },
  pinCode: { type: String, trim: true },

  // Tab 3: Parent / Guardian
  parentDetails: {
    fatherName: { type: String, required: true },
    fatherOccupation: { type: String, trim: true },
    fatherQualification: { type: String, trim: true },
    fatherMobile: { type: String, trim: true },
    fatherEmail: { type: String, trim: true },
    motherName: { type: String, required: true },
    motherOccupation: { type: String, trim: true },
    motherQualification: { type: String, trim: true },
    motherMobile: { type: String, trim: true },
    motherEmail: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true },
    guardianMobile: { type: String, trim: true },
    guardianAddress: { type: String, trim: true },
    annualFamilyIncome: { type: String, trim: true },
    emergencyContact: { type: String, trim: true }
  },

  // Tab 4: Academic
  academicYear: { type: String, trim: true },
  admissionYear: { type: String, trim: true },
  admissionDate: { type: Date, default: Date.now },
  admissionType: { type: String, trim: true },
  previousSchool: { type: String, trim: true },
  previousBoard: { type: String, trim: true },
  previousPercentage: { type: String, trim: true },
  passingYear: { type: String, trim: true },
  department: { type: String, required: true },
  course: { type: String, required: true },
  branch: { type: String, trim: true },
  semester: { type: String, required: true },
  division: { type: String, trim: true },
  batch: { type: String, trim: true },
  section: { type: String, trim: true },
  shift: { type: String, trim: true },
  medium: { type: String, trim: true },
  classTeacher: { type: String, trim: true },
  mentor: { type: String, trim: true },

  // Tab 5: Hostel & Transport
  hostelRequired: { type: Boolean, default: false },
  hostelName: { type: String, trim: true },
  roomNumber: { type: String, trim: true },
  transportRequired: { type: Boolean, default: false },
  busRoute: { type: String, trim: true },
  busStop: { type: String, trim: true },

  // Tab 6: Medical
  height: { type: String, trim: true },
  weight: { type: String, trim: true },
  allergies: { type: String, trim: true },
  medicalConditions: { type: String, trim: true },
  disability: { type: Boolean, default: false },
  disabilityDetails: { type: String, trim: true },
  emergencyMedicalNotes: { type: String, trim: true },

  // Tab 7: Scholarship & Fee
  scholarshipApplicable: { type: Boolean, default: false },
  scholarshipName: { type: String, trim: true },
  scholarshipId: { type: String, trim: true },
  scholarshipAmount: { type: Number, default: 0 },
  feeCategory: { type: String, trim: true },
  totalFee: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  paymentMode: { type: String, trim: true },

  // Tab 8: Documents
  documents: [{
    type: { type: String },
    url: { type: String } // Not deeply needed here because we use existing Documents Setup/API, but good for local references if needed
  }],

  // Tab 9: Account
  username: { type: String, trim: true },
  password: { type: String, trim: true }, // Ideally hashed, but storing as plain text based on user requirements for now
  studentEmailLogin: { type: String, trim: true },
  accountStatus: { type: String, enum: ['Active', 'Suspended', 'Inactive'], default: 'Active' },
  generateAccount: { type: Boolean, default: false },

  // Legacy mappings for backwards compatibility
  address: { type: String, trim: true }, 
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  remarks: { type: String, default: '' },

  // Passing Remark / Academic Status
  passingRemark: { type: String, default: '' },
  effectiveAcademicYear: { type: String, default: '' },
  remarkDate: { type: Date },
  remarkBy: { type: String, default: '' },

  // Added for Student Promotion Module Enhancements
  feeStructure: { type: String, default: '' },
  synchronizedModules: [{ type: String }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', studentSchema);
