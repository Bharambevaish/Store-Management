import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ─── BULK IMPORT COMPONENT ──────────────────────────────────────────────────
function BulkImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const fileRef = useRef();

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const headers = ['studentId', 'admissionNumber', 'prn', 'rollNumber', 'firstName', 'lastName', 'dob', 'gender', 'mobile', 'email', 'address', 'fatherName', 'motherName', 'parentMobile', 'course', 'department', 'semester'];
  const sample = ['STU003', 'ADM003', 'PRN003', 'R003', 'Ravi', 'Kumar', '2001-05-10', 'Male', '9876543210', 'ravi@example.com', 'Pune, MH', 'Suresh Kumar', 'Meena Devi', '9988776655', 'B.Tech Computer Engineering', 'Computer Engineering', '1'];

  const downloadCSVTemplate = () => {
    const csvContent = headers.join(',') + '\n' + sample.map(s => `"${s}"`).join(',');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'student_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        const rows = json.map((row, idx) => {
          let rowErrors = [];
          if (!row.studentId) rowErrors.push("Student ID required");
          if (!row.rollNumber) rowErrors.push("Roll Number required");
          if (!row.firstName) rowErrors.push("First name required");
          if (!row.email) rowErrors.push("Email required");
          
          return { _row: idx + 2, _errors: rowErrors, ...row };
        });
        setPreview(rows);
      } catch (err) {
        triggerAlert('error', 'Failed to parse file: ' + err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const mapRow = (row) => ({
    studentId: row.studentId,
    admissionNumber: row.admissionNumber || row.studentId,
    prn: row.prn || '',
    rollNumber: row.rollNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    dob: row.dob,
    gender: row.gender || 'Male',
    mobile: row.mobile,
    email: row.email,
    address: row.address,
    parentDetails: {
      fatherName: row.fatherName || '',
      motherName: row.motherName || '',
      parentMobile: row.parentMobile || row.mobile
    },
    course: row.course,
    department: row.department,
    semester: row.semester || '1',
    status: 'Active'
  });

  const handleImport = async () => {
    if (!preview.length) { triggerAlert('error', 'No data to import'); return; }
    const validRows = preview.filter(r => r._errors.length === 0);
    if (!validRows.length) { triggerAlert('error', 'No valid rows to import'); return; }
    
    setImporting(true);
    try {
      const students = validRows.map(mapRow);
      const res = await api.post('/students/bulk-import', { students });
      setImportResult(res.data);
      if (res.data.imported > 0) onSuccess();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--white)', borderRadius: '12px', padding: '28px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#2F5597' }}>📥 Bulk Student Import</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        {alert.show && (
          <div className={`alert-banner ${alert.type}`} style={{ marginBottom: '16px' }}>
            <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          </div>
        )}

        {/* Template Download */}
        <div style={{ background: '#f0f4ff', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>Step 1: Download the template, fill it out, then upload below.</p>
          <button onClick={downloadExcelTemplate} className="secondary" style={{ marginRight: '10px' }}>
            📊 Download Excel Template
          </button>
          <button onClick={downloadCSVTemplate} className="secondary" style={{ marginRight: '10px' }}>
            📄 Download CSV Template
          </button>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Required columns: studentId, rollNumber, firstName, lastName, dob, gender, mobile, email, address, fatherName, motherName, parentMobile, course, department, semester
          </div>
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Step 2: Upload CSV / Excel File</label>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ border: '2px dashed #2F5597', borderRadius: '8px', padding: '20px', width: '100%', cursor: 'pointer' }} />
        </div>

        {/* Preview Table */}
        {parsing && <p style={{ textAlign: 'center', color: '#666' }}>⏳ Parsing file...</p>}
        {preview.length > 0 && !importResult && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontWeight: '600', marginBottom: '8px' }}>Step 3: Preview ({preview.length} records found)</p>
            <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', maxHeight: '300px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#2F5597', color: '#fff' }}>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Row</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Student ID</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Course</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ background: row._errors.length ? '#fff5f5' : (i % 2 === 0 ? '#fafafa' : '#fff') }}>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>{row._row}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>
                        {row._errors.length > 0 ? (
                          <span style={{ color: '#c53030', fontWeight: 'bold' }}>❌ {row._errors.join(', ')}</span>
                        ) : (
                          <span style={{ color: '#38a169', fontWeight: 'bold' }}>✅ Valid</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>{row.studentId}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>{row.firstName} {row.lastName}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>{row.email}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #eee' }}>{row.course}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={handleImport} className="primary" disabled={importing}>
                {importing ? '⏳ Importing...' : `📤 Import ${preview.filter(r => !r._errors.length).length} Valid Students`}
              </button>
              <button onClick={() => { setPreview([]); setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="secondary">Clear</button>
            </div>
          </div>
        )}

        {/* Import Result Summary */}
        {importResult && (
          <div style={{ background: '#f0fff4', borderRadius: '10px', padding: '20px', border: '1px solid #48bb78' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#276749' }}>✅ Import Complete</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Total Records', value: importResult.total, color: '#2F5597' },
                { label: 'Successfully Imported', value: importResult.imported, color: '#38a169' },
                { label: 'Failed Records', value: importResult.failed, color: '#e53e3e' },
                { label: 'Duplicates Skipped', value: importResult.duplicates, color: '#d69e2e' }
              ].map(stat => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: '8px', padding: '12px', textAlign: 'center', border: `2px solid ${stat.color}` }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
            {importResult.errors.length > 0 && (
              <div>
                <p style={{ fontWeight: '600', color: '#e53e3e', marginBottom: '8px' }}>Backend Errors:</p>
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#fff5f5', borderRadius: '6px', padding: '8px' }}>
                  {importResult.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#c53030', padding: '3px 0', borderBottom: '1px solid #fed7d7' }}>
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onClose} className="primary" style={{ marginTop: '16px' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ADD STUDENT COMPONENT ─────────────────────────────────────────────
export default function AddStudent() {
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [documentSetups, setDocumentSetups] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const totalTabs = 9;
  
  const [formData, setFormData] = useState({
    studentId: '', admissionNumber: '', rollNumber: '', enrollmentNumber: '', prn: '',
    firstName: '', middleName: '', lastName: '', dob: '', gender: 'Male',
    bloodGroup: '', category: '', religion: '', caste: '', subCaste: '', nationality: '',
    aadhaarNumber: '', panNumber: '', passportNumber: '', birthPlace: '', motherTongue: '',
    maritalStatus: '', studentStatus: 'Active', photo: '',
    mobile: '', alternateMobile: '', email: '', alternateEmail: '', currentAddress: '',
    permanentAddress: '', city: '', taluka: '', district: '', state: '', country: '', pinCode: '', sameAsCurrentAddress: false,
    parentDetails: {
      fatherName: '', fatherOccupation: '', fatherQualification: '', fatherMobile: '', fatherEmail: '',
      motherName: '', motherOccupation: '', motherQualification: '', motherMobile: '', motherEmail: '',
      guardianName: '', guardianRelationship: '', guardianMobile: '', guardianAddress: '',
      annualFamilyIncome: '', emergencyContact: ''
    },
    academicYear: '', admissionDate: '', admissionType: '', previousSchool: '', previousBoard: '',
    previousPercentage: '', passingYear: '', department: '', course: '', branch: '', semester: '1',
    division: '', batch: '', section: '', shift: '', medium: '', classTeacher: '', mentor: '',
    hostelRequired: false, hostelName: '', roomNumber: '', transportRequired: false, busRoute: '', busStop: '',
    height: '', weight: '', allergies: '', medicalConditions: '', disability: false, disabilityDetails: '', emergencyMedicalNotes: '',
    scholarshipApplicable: false, scholarshipName: '', scholarshipId: '', scholarshipAmount: 0,
    feeCategory: '', totalFee: 0, paidAmount: 0, pendingAmount: 0, paymentMode: '',
    username: '', password: '', studentEmailLogin: '', accountStatus: 'Active', generateAccount: false
  });

  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const coursesRes = await api.get('/courses');
      setCourses(coursesRes.data);
      const settingsRes = await api.get('/settings');
      setSettings(settingsRes.data);
      const docRes = await api.get('/documents/setup');
      setDocumentSetups(docRes.data);
    } catch (err) { console.error(err); }
  };

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocSelection = (e, setup) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingDocs(prev => {
        const others = prev.filter(p => p.setupId !== setup._id);
        return [...others, {
          setupId: setup._id,
          documentType: setup.documentTitle,
          fileName: file.name,
          fileContent: reader.result
        }];
      });
    };
    reader.readAsDataURL(file);
  };

  const validateTab = (tab) => {
    const newErrors = {};
    if (tab === 1) {
      if (!formData.studentId) newErrors.studentId = 'Student ID required';
      if (!formData.rollNumber) newErrors.rollNumber = 'Roll Number required';
      if (!formData.firstName) newErrors.firstName = 'First name required';
      if (!formData.lastName) newErrors.lastName = 'Last name required';
      if (!formData.dob) newErrors.dob = 'DOB required';
      if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) newErrors.aadhaarNumber = '12-digit Aadhaar required';
    } else if (tab === 2) {
      if (!formData.mobile || !/^[0-9]{10}$/.test(formData.mobile)) newErrors.mobile = '10-digit mobile required';
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email required';
      if (!formData.currentAddress) newErrors.currentAddress = 'Current Address required';
      if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode)) newErrors.pinCode = '6-digit PIN required';
    } else if (tab === 3) {
      if (!formData.parentDetails.fatherName) newErrors.fatherName = "Father's name required";
      if (!formData.parentDetails.motherName) newErrors.motherName = "Mother's name required";
    } else if (tab === 4) {
      if (!formData.course) newErrors.course = 'Course required';
      if (!formData.department) newErrors.department = 'Department required';
      if (!formData.semester) newErrors.semester = 'Semester required';
    }
    return newErrors;
  };

  const handleNext = () => {
    if (activeTab < totalTabs) {
      setActiveTab(activeTab + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (activeTab > 1) setActiveTab(activeTab - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabClick = (index) => {
    setActiveTab(index);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Validate all tabs sequentially on submit
    for (let i = 1; i <= totalTabs; i++) {
      const tabErrors = validateTab(i);
      if (Object.keys(tabErrors).length > 0) {
        setErrors(tabErrors);
        setActiveTab(i);
        triggerAlert('error', `Please fix all validation errors on Tab ${i} before submitting.`);
        return;
      }
    }

    setLoading(true);
    const payload = { ...formData, address: formData.currentAddress };
    
    try {
      const res = await api.post('/students', payload);
      const newStudent = res.data;

      if (pendingDocs.length > 0 && newStudent && newStudent.studentId) {
        for (const doc of pendingDocs) {
          try {
            await api.post('/documents/upload', {
              studentId: newStudent.studentId,
              documentSetupId: doc.setupId,
              documentType: doc.documentType,
              fileName: doc.fileName,
              fileContent: doc.fileContent
            });
          } catch(err) {
            console.error('Failed to upload doc', doc.fileName, err);
          }
        }
      }

      triggerAlert('success', `Student "${formData.firstName} ${formData.lastName}" added successfully!`);
      resetForm();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to add student.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActiveTab(1);
    setFormData({
      studentId: '', admissionNumber: '', rollNumber: '', enrollmentNumber: '', prn: '',
      firstName: '', middleName: '', lastName: '', dob: '', gender: 'Male',
      bloodGroup: '', category: '', religion: '', caste: '', subCaste: '', nationality: '',
      aadhaarNumber: '', panNumber: '', passportNumber: '', birthPlace: '', motherTongue: '',
      maritalStatus: '', studentStatus: 'Active', photo: '',
      mobile: '', alternateMobile: '', email: '', alternateEmail: '', currentAddress: '',
      permanentAddress: '', city: '', taluka: '', district: '', state: '', country: '', pinCode: '', sameAsCurrentAddress: false,
      parentDetails: { fatherName: '', fatherOccupation: '', fatherQualification: '', fatherMobile: '', fatherEmail: '', motherName: '', motherOccupation: '', motherQualification: '', motherMobile: '', motherEmail: '', guardianName: '', guardianRelationship: '', guardianMobile: '', guardianAddress: '', annualFamilyIncome: '', emergencyContact: '' },
      academicYear: '', admissionDate: '', admissionType: '', previousSchool: '', previousBoard: '', previousPercentage: '', passingYear: '', department: '', course: '', branch: '', semester: '1', division: '', batch: '', section: '', shift: '', medium: '', classTeacher: '', mentor: '',
      hostelRequired: false, hostelName: '', roomNumber: '', transportRequired: false, busRoute: '', busStop: '',
      height: '', weight: '', allergies: '', medicalConditions: '', disability: false, disabilityDetails: '', emergencyMedicalNotes: '',
      scholarshipApplicable: false, scholarshipName: '', scholarshipId: '', scholarshipAmount: 0, feeCategory: '', totalFee: 0, paidAmount: 0, pendingAmount: 0, paymentMode: '',
      username: '', password: '', studentEmailLogin: '', accountStatus: 'Active', generateAccount: false
    });
    setPendingDocs([]);
    setErrors({});
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    if (name.startsWith('parent_')) {
      const field = name.split('parent_')[1];
      setFormData(prev => ({ ...prev, parentDetails: { ...prev.parentDetails, [field]: val } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: val }));
      
      if (name === 'sameAsCurrentAddress' && checked) {
        setFormData(prev => ({ ...prev, permanentAddress: prev.currentAddress }));
      }
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleExport = async (type) => {
    try {
      setLoading(true);
      const res = await api.get('/students');
      const allStudents = res.data.students || res.data || [];
      if (!allStudents.length) { triggerAlert('warning', 'No students available to export.'); return; }
      
      const exportData = allStudents.map(s => ({
        "Student ID": s.studentId, "Admission Number": s.admissionNumber || s.studentId,
        "PRN": s.prn || '', "Roll Number": s.rollNumber, "First Name": s.firstName, "Last Name": s.lastName,
        "DOB": s.dob ? new Date(s.dob).toLocaleDateString() : '', "Gender": s.gender, "Mobile": s.mobile,
        "Email": s.email, "Course": s.course, "Department": s.department, "Semester": s.semester, "Status": s.status
      }));

      if (type === 'excel') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, "all_students_export.xlsx");
      } else if (type === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("All Students Export", 14, 15);
        const headers = Object.keys(exportData[0]);
        const data = exportData.map(row => headers.map(h => row[h] || ''));
        doc.autoTable({ head: [headers], body: data, startY: 20, styles: { fontSize: 7, cellPadding: 1 }, headStyles: { fillColor: [47, 85, 151] } });
        doc.save("all_students_export.pdf");
      }
      triggerAlert('success', `Successfully exported to ${type.toUpperCase()}!`);
    } catch (err) { triggerAlert('error', 'Failed to export students.'); } finally { setLoading(false); }
  };

  const depts = settings?.departments || ['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering'];
  const tabNames = ['Personal Info', 'Contact Info', 'Parent/Guardian', 'Academic', 'Hostel & Transport', 'Medical', 'Scholarship & Fees', 'Documents', 'Account'];

  return (
    <div>
      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => { setShowBulkImport(false); triggerAlert('success', 'Bulk import completed!'); }}
        />
      )}

      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, color: '#2F5597' }}>Add New Student</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => handleExport('excel')} className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', borderColor: '#2F5597', color: '#2F5597' }}>📊 Export Excel</button>
          <button onClick={() => handleExport('pdf')} className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', borderColor: '#c53030', color: '#c53030' }}>📄 Export PDF</button>
          <button onClick={() => setShowBulkImport(true)} className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>📥 Bulk Student Import</button>
        </div>
      </div>

      {/* Wizard Tabs Header */}
      <div style={{ display: 'flex', overflowX: 'auto', marginBottom: '24px', borderBottom: '2px solid #E8F0FE', paddingBottom: '8px', gap: '8px' }}>
        {tabNames.map((name, i) => {
          const tabIndex = i + 1;
          const isActive = activeTab === tabIndex;
          const isPast = activeTab > tabIndex;
          return (
            <button
              key={tabIndex}
              onClick={() => handleTabClick(tabIndex)}
              type="button"
              style={{
                background: isActive ? '#2F5597' : isPast ? '#E8F0FE' : 'transparent',
                color: isActive ? '#FFF' : isPast ? '#2F5597' : '#666',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tabIndex}. {name}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* TAB 1: PERSONAL INFO */}
        {activeTab === 1 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>👤 Personal Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Student ID (Auto Generate)*</label>
                <input name="studentId" value={formData.studentId} onChange={handleChange} placeholder="e.g. STU2025001" />
                {errors.studentId && <span className="error-text">{errors.studentId}</span>}
              </div>
              <div className="form-group">
                <label>Admission Number</label>
                <input name="admissionNumber" value={formData.admissionNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Roll Number *</label>
                <input name="rollNumber" value={formData.rollNumber} onChange={handleChange} />
                {errors.rollNumber && <span className="error-text">{errors.rollNumber}</span>}
              </div>
              <div className="form-group">
                <label>Enrollment Number</label>
                <input name="enrollmentNumber" value={formData.enrollmentNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>PRN</label>
                <input name="prn" value={formData.prn} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>First Name *</label>
                <input name="firstName" value={formData.firstName} onChange={handleChange} />
                {errors.firstName && <span className="error-text">{errors.firstName}</span>}
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input name="middleName" value={formData.middleName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input name="lastName" value={formData.lastName} onChange={handleChange} />
                {errors.lastName && <span className="error-text">{errors.lastName}</span>}
              </div>
              <div className="form-group">
                <label>Full Name (Auto)</label>
                <input disabled value={`${formData.firstName} ${formData.middleName} ${formData.lastName}`.trim()} style={{ background: '#f5f5f5' }} />
              </div>
              <div className="form-group">
                <label>Date of Birth *</label>
                <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                {errors.dob && <span className="error-text">{errors.dob}</span>}
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <input name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input name="category" value={formData.category} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Religion</label>
                <input name="religion" value={formData.religion} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Caste</label>
                <input name="caste" value={formData.caste} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Sub Caste</label>
                <input name="subCaste" value={formData.subCaste} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Nationality</label>
                <input name="nationality" value={formData.nationality} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Aadhaar Number</label>
                <input name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} maxLength="12" pattern="[0-9]{12}" title="12 digit Aadhaar number" />
                {errors.aadhaarNumber && <span className="error-text">{errors.aadhaarNumber}</span>}
              </div>
              <div className="form-group">
                <label>PAN Number</label>
                <input name="panNumber" value={formData.panNumber} onChange={handleChange} maxLength="10" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}" title="Valid PAN format (e.g., ABCDE1234F)" />
              </div>
              <div className="form-group">
                <label>Passport Number</label>
                <input name="passportNumber" value={formData.passportNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Birth Place</label>
                <input name="birthPlace" value={formData.birthPlace} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Mother Tongue</label>
                <input name="motherTongue" value={formData.motherTongue} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Marital Status</label>
                <input name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Student Status</label>
                <select name="studentStatus" value={formData.studentStatus} onChange={handleChange}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Alumni">Alumni</option>
                  <option value="Dropped">Dropped</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Student Photograph</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {formData.photo && <img src={formData.photo} alt="Preview" style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ddd' }} />}
                  <div>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'block', marginBottom: '8px' }} />
                    <span style={{ fontSize: '12px', color: '#888' }}>Upload passport-size photo (JPG/PNG)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTACT INFO */}
        {activeTab === 2 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>📞 Contact Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Mobile Number *</label>
                <input name="mobile" value={formData.mobile} onChange={handleChange} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" required />
                {errors.mobile && <span className="error-text">{errors.mobile}</span>}
              </div>
              <div className="form-group">
                <label>Alternate Mobile</label>
                <input name="alternateMobile" value={formData.alternateMobile} onChange={handleChange} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} required />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label>Alternate Email</label>
                <input name="alternateEmail" type="email" value={formData.alternateEmail} onChange={handleChange} />
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Current Address *</label>
                <textarea name="currentAddress" value={formData.currentAddress} onChange={handleChange} rows="2" style={{ resize: 'vertical' }} />
                {errors.currentAddress && <span className="error-text">{errors.currentAddress}</span>}
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal' }}>
                  <input type="checkbox" name="sameAsCurrentAddress" checked={formData.sameAsCurrentAddress} onChange={handleChange} />
                  Permanent Address is same as Current Address
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Permanent Address</label>
                <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} rows="2" style={{ resize: 'vertical' }} disabled={formData.sameAsCurrentAddress} />
              </div>
              
              <div className="form-group">
                <label>City</label>
                <input name="city" value={formData.city} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Taluka</label>
                <input name="taluka" value={formData.taluka} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>District</label>
                <input name="district" value={formData.district} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input name="state" value={formData.state} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input name="country" value={formData.country} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>PIN Code</label>
                <input name="pinCode" value={formData.pinCode} onChange={handleChange} maxLength="6" pattern="[0-9]{6}" title="6 digit PIN code" />
                {errors.pinCode && <span className="error-text">{errors.pinCode}</span>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARENT / GUARDIAN INFO */}
        {activeTab === 3 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>👨‍👩‍👧 Parent / Guardian Information</h3>
            
            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Father Details</h4>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group"><label>Name *</label><input name="parent_fatherName" value={formData.parentDetails.fatherName} onChange={handleChange} />{errors.fatherName && <span className="error-text">{errors.fatherName}</span>}</div>
              <div className="form-group"><label>Occupation</label><input name="parent_fatherOccupation" value={formData.parentDetails.fatherOccupation} onChange={handleChange} /></div>
              <div className="form-group"><label>Qualification</label><input name="parent_fatherQualification" value={formData.parentDetails.fatherQualification} onChange={handleChange} /></div>
              <div className="form-group"><label>Mobile</label><input name="parent_fatherMobile" value={formData.parentDetails.fatherMobile} onChange={handleChange} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" />{errors.fatherMobile && <span className="error-text">{errors.fatherMobile}</span>}</div>
              <div className="form-group"><label>Email</label><input name="parent_fatherEmail" type="email" value={formData.parentDetails.fatherEmail} onChange={handleChange} /></div>
            </div>

            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Mother Details</h4>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group"><label>Name *</label><input name="parent_motherName" value={formData.parentDetails.motherName} onChange={handleChange} />{errors.motherName && <span className="error-text">{errors.motherName}</span>}</div>
              <div className="form-group"><label>Occupation</label><input name="parent_motherOccupation" value={formData.parentDetails.motherOccupation} onChange={handleChange} /></div>
              <div className="form-group"><label>Qualification</label><input name="parent_motherQualification" value={formData.parentDetails.motherQualification} onChange={handleChange} /></div>
              <div className="form-group"><label>Mobile</label><input name="parent_motherMobile" value={formData.parentDetails.motherMobile} onChange={handleChange} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" /></div>
              <div className="form-group"><label>Email</label><input name="parent_motherEmail" type="email" value={formData.parentDetails.motherEmail} onChange={handleChange} /></div>
            </div>

            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Guardian Details</h4>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group"><label>Name</label><input name="parent_guardianName" value={formData.parentDetails.guardianName} onChange={handleChange} /></div>
              <div className="form-group"><label>Relationship</label><input name="parent_guardianRelationship" value={formData.parentDetails.guardianRelationship} onChange={handleChange} /></div>
              <div className="form-group"><label>Mobile</label><input name="parent_guardianMobile" value={formData.parentDetails.guardianMobile} onChange={handleChange} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Address</label><input name="parent_guardianAddress" value={formData.parentDetails.guardianAddress} onChange={handleChange} /></div>
            </div>

            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Additional</h4>
            <div className="form-grid">
              <div className="form-group"><label>Annual Family Income</label><input name="parent_annualFamilyIncome" type="number" step="1000" min="0" value={formData.parentDetails.annualFamilyIncome} onChange={handleChange} /></div>
              <div className="form-group"><label>Emergency Contact</label><input name="parent_emergencyContact" value={formData.parentDetails.emergencyContact} onChange={handleChange} /></div>
            </div>
          </div>
        )}

        {/* TAB 4: ACADEMIC INFO */}
        {activeTab === 4 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>🎓 Academic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Course *</label>
                <select name="course" value={formData.course} onChange={handleChange}>
                  <option value="">-- Select --</option>
                  {courses.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
                {errors.course && <span className="error-text">{errors.course}</span>}
              </div>
              <div className="form-group">
                <label>Department *</label>
                <select name="department" value={formData.department} onChange={handleChange}>
                  <option value="">-- Select --</option>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <span className="error-text">{errors.department}</span>}
              </div>
              <div className="form-group">
                <label>Semester *</label>
                <select name="semester" value={formData.semester} onChange={handleChange}>
                  {['1','2','3','4','5','6','7','8'].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
                {errors.semester && <span className="error-text">{errors.semester}</span>}
              </div>
              <div className="form-group">
                <label>Academic Year</label>
                <select name="academicYear" value={formData.academicYear} onChange={handleChange}>
                  <option value="">Select Year</option>
                  {['2022-23', '2023-24', '2024-25', '2025-26', '2026-27', '2027-28'].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Admission Date</label><input type="date" name="admissionDate" value={formData.admissionDate} onChange={handleChange} /></div>
              <div className="form-group"><label>Admission Type</label><input name="admissionType" value={formData.admissionType} onChange={handleChange} placeholder="e.g. CAP, Management" /></div>
              <div className="form-group"><label>Previous School/College</label><input name="previousSchool" value={formData.previousSchool} onChange={handleChange} /></div>
              <div className="form-group"><label>Previous Board</label><input name="previousBoard" value={formData.previousBoard} onChange={handleChange} /></div>
              <div className="form-group"><label>Previous % / CGPA</label><input name="previousPercentage" type="number" step="0.01" min="0" max="100" value={formData.previousPercentage} onChange={handleChange} /></div>
              <div className="form-group"><label>Passing Year</label><input name="passingYear" value={formData.passingYear} onChange={handleChange} /></div>
              <div className="form-group"><label>Branch</label><input name="branch" value={formData.branch} onChange={handleChange} /></div>
              <div className="form-group"><label>Division</label><input name="division" value={formData.division} onChange={handleChange} /></div>
              <div className="form-group"><label>Batch</label><input name="batch" value={formData.batch} onChange={handleChange} /></div>
              <div className="form-group"><label>Section</label><input name="section" value={formData.section} onChange={handleChange} /></div>
              <div className="form-group"><label>Shift</label><input name="shift" value={formData.shift} onChange={handleChange} /></div>
              <div className="form-group"><label>Medium</label><input name="medium" value={formData.medium} onChange={handleChange} /></div>
              <div className="form-group"><label>Class Teacher</label><input name="classTeacher" value={formData.classTeacher} onChange={handleChange} /></div>
              <div className="form-group"><label>Mentor</label><input name="mentor" value={formData.mentor} onChange={handleChange} /></div>
            </div>
          </div>
        )}

        {/* TAB 5: HOSTEL & TRANSPORT */}
        {activeTab === 5 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>🚌 Hostel & Transport</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <input type="checkbox" name="hostelRequired" checked={formData.hostelRequired} onChange={handleChange} />
                  Hostel Accommodation Required
                </label>
              </div>
              {formData.hostelRequired && (
                <>
                  <div className="form-group"><label>Hostel Name</label><input name="hostelName" value={formData.hostelName} onChange={handleChange} /></div>
                  <div className="form-group"><label>Room Number</label><input name="roomNumber" value={formData.roomNumber} onChange={handleChange} /></div>
                </>
              )}
            </div>
            <div className="form-grid" style={{ marginTop: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <input type="checkbox" name="transportRequired" checked={formData.transportRequired} onChange={handleChange} />
                  Transport / Bus Required
                </label>
              </div>
              {formData.transportRequired && (
                <>
                  <div className="form-group"><label>Bus Route</label><input name="busRoute" value={formData.busRoute} onChange={handleChange} /></div>
                  <div className="form-group"><label>Bus Stop</label><input name="busStop" value={formData.busStop} onChange={handleChange} /></div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: MEDICAL */}
        {activeTab === 6 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>⚕️ Medical Information</h3>
            <div className="form-grid">
              <div className="form-group"><label>Height (cm)</label><input name="height" type="number" step="0.1" min="0" max="500" value={formData.height} onChange={handleChange} /></div>
              <div className="form-group"><label>Weight (kg)</label><input name="weight" type="number" step="0.1" min="0" max="500" value={formData.weight} onChange={handleChange} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Allergies</label><input name="allergies" value={formData.allergies} onChange={handleChange} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Medical Conditions</label><input name="medicalConditions" value={formData.medicalConditions} onChange={handleChange} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <input type="checkbox" name="disability" checked={formData.disability} onChange={handleChange} />
                  Physical Disability
                </label>
              </div>
              {formData.disability && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Disability Details</label><input name="disabilityDetails" value={formData.disabilityDetails} onChange={handleChange} /></div>
              )}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Emergency Medical Notes</label><textarea name="emergencyMedicalNotes" value={formData.emergencyMedicalNotes} onChange={handleChange} rows="2" /></div>
            </div>
          </div>
        )}

        {/* TAB 7: SCHOLARSHIP & FEES */}
        {activeTab === 7 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>💰 Scholarship & Fee Details</h3>
            
            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Scholarship</h4>
            <div className="form-grid" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <input type="checkbox" name="scholarshipApplicable" checked={formData.scholarshipApplicable} onChange={handleChange} />
                  Scholarship Applicable
                </label>
              </div>
              {formData.scholarshipApplicable && (
                <>
                  <div className="form-group"><label>Scholarship Name</label><input name="scholarshipName" value={formData.scholarshipName} onChange={handleChange} /></div>
                  <div className="form-group"><label>Scholarship ID</label><input name="scholarshipId" value={formData.scholarshipId} onChange={handleChange} /></div>
                  <div className="form-group"><label>Amount</label><input type="number" name="scholarshipAmount" value={formData.scholarshipAmount} onChange={handleChange} /></div>
                </>
              )}
            </div>

            <h4 style={{ color: '#595959', marginBottom: '12px' }}>Fees</h4>
            <div className="form-grid">
              <div className="form-group"><label>Fee Category</label><input name="feeCategory" value={formData.feeCategory} onChange={handleChange} /></div>
              <div className="form-group"><label>Total Fee</label><input type="number" name="totalFee" value={formData.totalFee} onChange={handleChange} /></div>
              <div className="form-group"><label>Paid Amount</label><input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} /></div>
              <div className="form-group"><label>Pending Amount</label><input type="number" name="pendingAmount" value={formData.pendingAmount} onChange={handleChange} /></div>
              <div className="form-group"><label>Payment Mode</label><input name="paymentMode" value={formData.paymentMode} onChange={handleChange} placeholder="e.g. Cash, UPI, Bank Transfer" /></div>
            </div>
          </div>
        )}

        {/* TAB 8: DOCUMENTS */}
        {activeTab === 8 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>📂 Documents</h3>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '600px', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Mandatory</th>
                    <th>Upload File</th>
                  </tr>
                </thead>
                <tbody>
                  {documentSetups.filter(setup => {
                     if (setup.applicableFor === 'All Students') return true;
                     if (setup.applicableFor === 'UG' && formData.course && formData.course.includes('B.')) return true;
                     if (setup.applicableFor === 'PG' && formData.course && formData.course.includes('M.')) return true;
                     if (setup.applicableFor === formData.course) return true;
                     return true;
                  }).map(setup => {
                    const isPending = pendingDocs.find(p => p.setupId === setup._id);
                    return (
                      <tr key={setup._id}>
                        <td>
                          <strong>{setup.documentTitle}</strong>
                          {setup.description && <div style={{ fontSize: '11px', color: '#7F7F7F' }}>{setup.description}</div>}
                        </td>
                        <td>{setup.mandatory ? <span style={{ color: '#C00000', fontWeight: 'bold' }}>Yes</span> : 'No'}</td>
                        <td>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#38a169', fontWeight: 'bold', fontSize: '12px' }}>✅ {isPending.fileName}</span>
                              <a href={isPending.fileContent} target="_blank" rel="noopener noreferrer" style={{ color: '#2b6cb0', fontSize: '12px', textDecoration: 'none' }}>👁️ Preview</a>
                              <a href={isPending.fileContent} download={isPending.fileName} style={{ color: '#2b6cb0', fontSize: '12px', textDecoration: 'none' }}>⬇️ Download</a>
                              <label style={{ fontSize: '12px', cursor: 'pointer', color: '#d97706' }}>
                                🔄 Replace
                                <input type="file" style={{ display: 'none' }} onChange={(e) => handleDocSelection(e, setup)} />
                              </label>
                              <button type="button" onClick={() => setPendingDocs(prev => prev.filter(p => p.setupId !== setup._id))} style={{ background: 'none', border: 'none', color: '#c53030', cursor: 'pointer', fontSize: '12px' }}>🗑️ Delete</button>
                            </div>
                          ) : setup.allowUpload ? (
                            <input type="file" style={{ fontSize: '12px' }} onChange={(e) => handleDocSelection(e, setup)} />
                          ) : (
                            <span style={{ fontSize: '12px', color: '#7F7F7F' }}>Upload via Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: ACCOUNT DETAILS */}
        {activeTab === 9 && (
          <div className="form-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #E8F0FE' }}>🔐 Account Details</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <input type="checkbox" name="generateAccount" checked={formData.generateAccount} onChange={handleChange} />
                  Generate Student Portal Account
                </label>
              </div>
              {formData.generateAccount && (
                <>
                  <div className="form-group">
                    <label>Username (Auto Generate)</label>
                    <input name="username" value={formData.username || formData.studentId} disabled style={{ background: '#f5f5f5' }} />
                  </div>
                  <div className="form-group">
                    <label>Password (Auto Generate)</label>
                    <input name="password" value={formData.password || (formData.dob ? formData.dob.split('-')[0] : '12345')} disabled style={{ background: '#f5f5f5' }} />
                  </div>
                  <div className="form-group">
                    <label>Student Email Login</label>
                    <input name="studentEmailLogin" value={formData.studentEmailLogin} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Account Status</label>
                    <select name="accountStatus" value={formData.accountStatus} onChange={handleChange}>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div className="btn-container" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#F8F9FA', borderRadius: '8px' }}>
          <div>
            {activeTab > 1 && (
              <button type="button" className="secondary" onClick={handlePrev}>
                ⬅️ Previous
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="secondary" onClick={resetForm}>
              🔄 Reset
            </button>
            {activeTab < totalTabs ? (
              <button type="button" className="primary" onClick={handleNext}>
                Next ➡️
              </button>
            ) : (
              <button type="submit" className="primary" style={{ background: '#276749', borderColor: '#276749' }} disabled={loading}>
                {loading ? '⏳ Saving...' : '✅ Save Student'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
