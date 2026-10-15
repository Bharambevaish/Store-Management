import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function StudentProfile() {
  const [searchTerm, setSearchTerm] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  
  // Doc uploads & setups
  const [documentSetups, setDocumentSetups] = useState([]);
  const [studentDocs, setStudentDocs] = useState([]);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  // Update profile details
  const [personalData, setPersonalData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [customDocName, setCustomDocName] = useState('');
  const [customFile, setCustomFile] = useState(null);
  
  const [certificates, setCertificates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [remarks, setRemarks] = useState([]);

  useEffect(() => {
    if (student) {
      const fetchStudentExtraData = async () => {
        try {
          const stuId = student.studentId;
          const stuMongoId = student._id;
          const [certs, apps, att, promo, rem] = await Promise.all([
            api.get(`/certificates?studentId=${stuId}`).catch(() => ({ data: [] })),
            api.get(`/applications?studentId=${stuId}`).catch(() => ({ data: [] })),
            api.get(`/attendance/${stuId}`).catch(() => ({ data: [] })),
            api.get(`/promotions/history/${stuId}`).catch(() => ({ data: [] })),
            api.get(`/passing-remarks/history/${stuMongoId}`).catch(() => ({ data: [] }))
          ]);
          setCertificates(certs.data);
          setApplications(apps.data);
          setAttendance(att.data);
          setPromotions(promo.data);
          setRemarks(rem.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchStudentExtraData();
    }
  }, [student]);

  const tabs = [
    'Personal Information',
    'Contact Information',
    'Parent / Guardian',
    'Academic Information',
    'Hostel & Transport',
    'Medical Information',
    'Scholarship & Fees',
    'Documents',
    'Certificates',
    'Applications',
    'Attendance',
    'Promotion History',
    'Passing Remarks'
  ];

  useEffect(() => {
    fetchDocumentSetups();
  }, []);

  const fetchDocumentSetups = async () => {
    try {
      const res = await api.get('/documents/setup');
      setDocumentSetups(res.data);
    } catch (err) {
      console.error('Failed to fetch document setups', err);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setStudent(null);
    setStudentDocs([]);
    setIsEditing(false);
    setActiveTab(1);
    try {
      const res = await api.get(`/students/${searchTerm.trim()}`);
      setStudent(res.data);
      setPersonalData({ ...res.data });
      fetchStudentDocuments(res.data.studentId);
    } catch (err) {
      triggerAlert('error', 'Student not found. Enter ID or full database object ID.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentDocuments = async (stuId) => {
    try {
      const res = await api.get(`/documents?studentId=${stuId}`);
      setStudentDocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocUpload = async (e, setup) => {
    const file = e.target.files[0];
    if (!file || !student) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploadingDocId(setup._id);
      try {
        await api.post('/documents/upload', {
          studentId: student.studentId,
          documentSetupId: setup._id,
          documentType: setup.documentTitle,
          fileName: file.name,
          fileContent: reader.result
        });
        triggerAlert('success', `${setup.documentTitle} uploaded successfully!`);
        fetchStudentDocuments(student.studentId);
      } catch (err) {
        triggerAlert('error', 'Failed to upload document');
      } finally {
        setUploadingDocId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDocDelete = async (docId) => {
    if(!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      triggerAlert('success', 'Document deleted successfully.');
      fetchStudentDocuments(student.studentId);
    } catch (err) {
      triggerAlert('error', 'Failed to delete document.');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!student) return;

    try {
      const payload = { ...personalData, address: personalData.currentAddress || personalData.address };
      const res = await api.put(`/students/${student._id}`, payload);
      setStudent(res.data.student);
      setPersonalData({ ...res.data.student });
      triggerAlert('success', 'Student profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to update student profile');
    }
  };

  const getCombinedDocs = () => {
    const combined = [];
    
    documentSetups.filter(setup => {
      if (setup.applicableFor === 'All Students') return true;
      if (setup.applicableFor === 'UG' && student.course && student.course.includes('B.')) return true; 
      if (setup.applicableFor === 'PG' && student.course && student.course.includes('M.')) return true;
      if (setup.applicableFor === student.course) return true;
      return true; 
    }).forEach(setup => {
      const uploaded = studentDocs.find(d => d.documentType === setup.documentTitle);
      combined.push({ setup, uploaded });
    });

    studentDocs.forEach(doc => {
      const matched = combined.find(c => c.setup && c.setup.documentTitle === doc.documentType);
      if (!matched) {
        combined.push({
          setup: { _id: doc._id + '_custom', documentTitle: doc.documentType, mandatory: false, allowUpload: true },
          uploaded: doc
        });
      }
    });
    
    return combined;
  };

  const handleCustomDocUpload = async () => {
    if (!customDocName.trim()) {
      triggerAlert('error', 'Please enter a document name.');
      return;
    }
    if (!customFile) {
      triggerAlert('error', 'Please choose a file to upload.');
      return;
    }
    if (!student) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await api.post('/documents/upload', {
          studentId: student.studentId,
          documentType: customDocName.trim(),
          fileName: customFile.name,
          fileContent: reader.result
        });
        triggerAlert('success', `${customDocName} uploaded successfully!`);
        setCustomDocName('');
        setCustomFile(null);
        document.getElementById('customFileInput').value = '';
        fetchStudentDocuments(student.studentId);
      } catch (err) {
        triggerAlert('error', 'Failed to upload custom document');
      }
    };
    reader.readAsDataURL(customFile);
  };

  const handleVerify = async (docId, status) => {
    try {
      await api.put(`/documents/${docId}/verify`, { status, remarks: '' });
      triggerAlert('success', `Document ${status.toLowerCase()} successfully`);
      fetchStudentDocuments(student.studentId);
    } catch (err) {
      triggerAlert('error', 'Failed to update document status');
    }
  };

  const handleExportDocsPDF = () => {
    if (!student) return;
    const doc = new jsPDF();
    doc.text(`Documents for ${student.firstName} ${student.lastName} (${student.studentId})`, 14, 15);
    const combined = getCombinedDocs();
    const rows = combined.map(c => [
      c.setup.documentTitle,
      c.uploaded ? c.uploaded.category || 'General' : (c.setup.category || 'General'),
      c.uploaded ? c.uploaded.verificationStatus : 'Not Uploaded',
      c.uploaded ? new Date(c.uploaded.createdAt).toLocaleDateString() : '-'
    ]);
    doc.autoTable({
      head: [['Document Name', 'Category', 'Status', 'Upload Date']],
      body: rows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [47, 85, 151] }
    });
    doc.save(`${student.studentId}_documents.pdf`);
  };

  const handleExportDocsExcel = () => {
    if (!student) return;
    const combined = getCombinedDocs();
    const data = combined.map(c => ({
      'Document Name': c.setup.documentTitle,
      'Category': c.uploaded ? c.uploaded.category || 'General' : (c.setup.category || 'General'),
      'Mandatory': c.setup.mandatory ? 'Yes' : 'No',
      'Status': c.uploaded ? c.uploaded.verificationStatus : 'Not Uploaded',
      'Upload Date': c.uploaded ? new Date(c.uploaded.createdAt).toLocaleDateString() : '-',
      'Uploaded By': c.uploaded ? c.uploaded.uploadedBy : '-',
      'Verified By': c.uploaded ? c.uploaded.verifiedBy || '-' : '-',
      'Remarks': c.uploaded ? c.uploaded.remarks || '-' : '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    XLSX.writeFile(wb, `${student.studentId}_documents.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!student) return;
    const doc = new jsPDF();
    doc.text(`Student Profile: ${student.firstName} ${student.lastName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`ID: ${student.studentId} | Roll: ${student.rollNumber}`, 14, 22);
    
    const details = [
      ['Course', student.course],
      ['Department', student.department],
      ['Semester', student.semester],
      ['Email', student.email],
      ['Mobile', student.mobile],
      ['Address', student.address || student.currentAddress || 'N/A']
    ];
    
    doc.autoTable({
      head: [['Field', 'Value']],
      body: details,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [47, 85, 151] }
    });
    
    doc.save(`${student.studentId}_profile.pdf`);
  };

  const handleExportExcel = () => {
    if (!student) return;
    const ws = XLSX.utils.json_to_sheet([{ ...student, parentDetails: JSON.stringify(student.parentDetails) }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profile");
    XLSX.writeFile(wb, `${student.studentId}_profile.xlsx`);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    if (name.startsWith('parent_')) {
      const field = name.split('parent_')[1];
      setPersonalData(prev => ({ ...prev, parentDetails: { ...prev.parentDetails, [field]: val } }));
    } else {
      setPersonalData(prev => ({ ...prev, [name]: val }));
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Search Section */}
      <div className="form-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: '#2F5597' }}>🔍 Load Student Profile</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1, maxWidth: 'none' }}
            placeholder="Enter Student ID, Admission Number, or Roll Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="primary">Search Profile</button>
        </form>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px' }}>Loading student file...</div>}

      {/* Main Profile View */}
      {student && personalData && (
        <>
          {/* Header Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setIsEditing(!isEditing)} className="secondary" style={{ borderColor: '#2F5597', color: '#2F5597' }}>
              {isEditing ? '❌ Cancel Editing' : '✏️ Edit Student'}
            </button>
            <button onClick={handlePrint} className="secondary">🖨️ Print Profile</button>
            <button onClick={handleExportPDF} className="secondary" style={{ borderColor: '#c53030', color: '#c53030' }}>📄 Export PDF</button>
            <button onClick={handleExportExcel} className="secondary" style={{ borderColor: '#38a169', color: '#38a169' }}>📊 Export Excel</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
            {/* Left Sidebar Menu */}
            <div className="form-card" style={{ padding: '16px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px', padding: '0 16px' }}>
                <div style={{
                  width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--pastel-blue)',
                  margin: '0 auto 12px auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', border: '3px solid var(--pastel-blue-dark)'
                }}>
                  {student.photo ? (
                    <img src={student.photo} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '32px' }}>👤</span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{student.firstName} {student.lastName}</h4>
                <div style={{ fontSize: '12px', color: '#7F7F7F', marginBottom: '8px' }}>
                  ID: {student.studentId} | Roll: {student.rollNumber}
                </div>
                <span className={`badge ${student.status === 'Active' ? 'active' : 'inactive'}`}>{student.status}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {tabs.map((tab, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveTab(idx + 1)}
                    style={{
                      background: activeTab === idx + 1 ? '#2F5597' : 'transparent',
                      color: activeTab === idx + 1 ? '#FFF' : '#333',
                      border: 'none',
                      borderLeft: activeTab === idx + 1 ? '4px solid #1a365d' : '4px solid transparent',
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: activeTab === idx + 1 ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    {idx + 1}. {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Content Panel */}
            <div className="form-card" style={{ padding: '24px' }}>
              <form onSubmit={handleProfileUpdate}>
                <h3 style={{ color: '#2F5597', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #E8F0FE' }}>
                  {tabs[activeTab - 1]}
                </h3>

                {/* 1. PERSONAL INFO */}
                {activeTab === 1 && (
                  <div className="form-grid">
                    <div className="form-group"><label>Student ID</label><input name="studentId" value={personalData.studentId} disabled /></div>
                    <div className="form-group"><label>Admission No</label><input name="admissionNumber" value={personalData.admissionNumber || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Roll Number</label><input name="rollNumber" value={personalData.rollNumber || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>PRN</label><input name="prn" value={personalData.prn || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>First Name</label><input name="firstName" value={personalData.firstName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Middle Name</label><input name="middleName" value={personalData.middleName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Last Name</label><input name="lastName" value={personalData.lastName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={personalData.dob ? personalData.dob.split('T')[0] : ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Gender</label><input name="gender" value={personalData.gender || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Blood Group</label><input name="bloodGroup" value={personalData.bloodGroup || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Aadhaar</label><input name="aadhaarNumber" value={personalData.aadhaarNumber || ''} onChange={handleChange} disabled={!isEditing} maxLength="12" pattern="[0-9]{12}" title="12 digit Aadhaar number" /></div>
                    <div className="form-group"><label>PAN</label><input name="panNumber" value={personalData.panNumber || ''} onChange={handleChange} disabled={!isEditing} maxLength="10" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}" title="Valid PAN format (e.g., ABCDE1234F)" /></div>
                    <div className="form-group"><label>Status</label><select name="status" value={personalData.status || 'Active'} onChange={handleChange} disabled={!isEditing}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
                  </div>
                )}

                {/* 2. CONTACT INFO */}
                {activeTab === 2 && (
                  <div className="form-grid">
                    <div className="form-group"><label>Mobile *</label><input name="mobile" value={personalData.mobile || ''} onChange={handleChange} disabled={!isEditing} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" required /></div>
                    <div className="form-group"><label>Alt Mobile</label><input name="alternateMobile" value={personalData.alternateMobile || ''} onChange={handleChange} disabled={!isEditing} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" /></div>
                    <div className="form-group"><label>Email *</label><input name="email" type="email" value={personalData.email || ''} onChange={handleChange} disabled={!isEditing} required /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Current Address</label><textarea name="currentAddress" value={personalData.currentAddress || personalData.address || ''} onChange={handleChange} disabled={!isEditing} rows="2" /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Permanent Address</label><textarea name="permanentAddress" value={personalData.permanentAddress || ''} onChange={handleChange} disabled={!isEditing} rows="2" /></div>
                    <div className="form-group"><label>City</label><input name="city" value={personalData.city || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>State</label><input name="state" value={personalData.state || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>PIN Code</label><input name="pinCode" value={personalData.pinCode || ''} onChange={handleChange} disabled={!isEditing} maxLength="6" pattern="[0-9]{6}" title="6 digit PIN code" /></div>
                  </div>
                )}

                {/* 3. PARENT INFO */}
                {activeTab === 3 && (
                  <div className="form-grid">
                    <div className="form-group"><label>Father's Name</label><input name="parent_fatherName" value={personalData.parentDetails?.fatherName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Father's Mobile</label><input name="parent_fatherMobile" value={personalData.parentDetails?.fatherMobile || personalData.parentDetails?.parentMobile || ''} onChange={handleChange} disabled={!isEditing} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" /></div>
                    <div className="form-group"><label>Father's Email</label><input name="parent_fatherEmail" type="email" value={personalData.parentDetails?.fatherEmail || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><hr style={{ border: 'none', borderTop: '1px solid #eee' }} /></div>
                    <div className="form-group"><label>Mother's Name</label><input name="parent_motherName" value={personalData.parentDetails?.motherName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Mother's Mobile</label><input name="parent_motherMobile" value={personalData.parentDetails?.motherMobile || ''} onChange={handleChange} disabled={!isEditing} maxLength="10" pattern="[0-9]{10}" title="10 digit mobile number" /></div>
                    <div className="form-group"><label>Mother's Email</label><input name="parent_motherEmail" type="email" value={personalData.parentDetails?.motherEmail || ''} onChange={handleChange} disabled={!isEditing} /></div>
                  </div>
                )}

                {/* 4. ACADEMIC INFO */}
                {activeTab === 4 && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Course</label>
                      <select name="course" value={personalData.course || ''} onChange={handleChange} disabled={!isEditing}>
                        <option value="">Select Course</option>
                        {['B.Tech (BTECH-CE)', 'B.Tech (BTECH-IT)', 'M.Tech (MTECH-CE)', 'BCA (BCA-01)', 'MCA (MCA-01)'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Department</label>
                      <select name="department" value={personalData.department || ''} onChange={handleChange} disabled={!isEditing}>
                        <option value="">Select Department</option>
                        {['Computer Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Electronics & Telecom', 'First Year (FE)'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Semester</label><input name="semester" value={personalData.semester || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group">
                      <label>Academic Year</label>
                      <select name="academicYear" value={personalData.academicYear || ''} onChange={handleChange} disabled={!isEditing}>
                        <option value="">Select Year</option>
                        {['2022-23', '2023-24', '2024-25', '2025-26', '2026-27', '2027-28'].map(yr => <option key={yr} value={yr}>{yr}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Admission Date</label><input name="admissionDate" type="date" value={personalData.admissionDate ? personalData.admissionDate.split('T')[0] : ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Class Teacher</label><input name="classTeacher" value={personalData.classTeacher || ''} onChange={handleChange} disabled={!isEditing} /></div>
                  </div>
                )}

                {/* 5. HOSTEL & TRANSPORT */}
                {activeTab === 5 && (
                  <div className="form-grid">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label><input type="checkbox" name="hostelRequired" checked={personalData.hostelRequired || false} onChange={handleChange} disabled={!isEditing} /> Hostel Required</label></div>
                    <div className="form-group"><label>Hostel Name</label><input name="hostelName" value={personalData.hostelName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Room Number</label><input name="roomNumber" value={personalData.roomNumber || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label><input type="checkbox" name="transportRequired" checked={personalData.transportRequired || false} onChange={handleChange} disabled={!isEditing} /> Transport Required</label></div>
                    <div className="form-group"><label>Bus Route</label><input name="busRoute" value={personalData.busRoute || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Bus Stop</label><input name="busStop" value={personalData.busStop || ''} onChange={handleChange} disabled={!isEditing} /></div>
                  </div>
                )}

                {/* 6. MEDICAL */}
                {activeTab === 6 && (
                  <div className="form-grid">
                    <div className="form-group"><label>Height (cm)</label><input name="height" type="number" step="0.1" min="0" max="500" value={personalData.height || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Weight (kg)</label><input name="weight" type="number" step="0.1" min="0" max="500" value={personalData.weight || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Allergies</label><input name="allergies" value={personalData.allergies || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Medical Conditions</label><input name="medicalConditions" value={personalData.medicalConditions || ''} onChange={handleChange} disabled={!isEditing} /></div>
                  </div>
                )}

                {/* 7. SCHOLARSHIP & FEES */}
                {activeTab === 7 && (
                  <div className="form-grid">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label><input type="checkbox" name="scholarshipApplicable" checked={personalData.scholarshipApplicable || false} onChange={handleChange} disabled={!isEditing} /> Scholarship Applicable</label></div>
                    <div className="form-group"><label>Scholarship Name</label><input name="scholarshipName" value={personalData.scholarshipName || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Total Fee</label><input name="totalFee" type="number" value={personalData.totalFee || ''} onChange={handleChange} disabled={!isEditing} /></div>
                    <div className="form-group"><label>Paid Amount</label><input name="paidAmount" type="number" value={personalData.paidAmount || ''} onChange={handleChange} disabled={!isEditing} /></div>
                  </div>
                )}

                {/* 8. DOCUMENTS */}
                {activeTab === 8 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, color: '#2F5597' }}>Student Documents</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="secondary icon-btn" onClick={handleExportDocsPDF}>📄 Export PDF</button>
                        <button type="button" className="secondary icon-btn" onClick={handleExportDocsExcel}>📊 Export Excel</button>
                      </div>
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                      <table style={{ minWidth: '800px', fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Document Name</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Upload Date</th>
                            <th>Uploaded By</th>
                            <th>Verified By</th>
                            <th>Remarks</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getCombinedDocs().map(({ setup, uploaded }) => (
                            <tr key={setup._id}>
                              <td>
                                <strong>{setup.documentTitle}</strong>
                                {setup.mandatory && <span style={{ color: '#C00000', fontWeight: 'bold', marginLeft: '4px', fontSize: '11px' }}>(Required)</span>}
                                {setup.description && <div style={{ fontSize: '11px', color: '#7F7F7F' }}>{setup.description}</div>}
                              </td>
                              <td>{uploaded ? (uploaded.category || 'General') : (setup.category || 'General')}</td>
                              <td>
                                {uploaded ? (
                                  <span className={`badge ${uploaded.verificationStatus === 'Approved' ? 'active' : uploaded.verificationStatus === 'Rejected' ? 'inactive' : 'pending'}`}>
                                    {uploaded.verificationStatus}
                                  </span>
                                ) : (
                                  <span className="badge" style={{ backgroundColor: '#EEE', color: '#555' }}>Not Uploaded</span>
                                )}
                              </td>
                              <td>{uploaded ? new Date(uploaded.createdAt).toLocaleDateString() : '-'}</td>
                              <td>{uploaded ? uploaded.uploadedBy : '-'}</td>
                              <td>{uploaded ? (uploaded.verifiedBy || '-') : '-'}</td>
                              <td>{uploaded ? (uploaded.remarks || '-') : '-'}</td>
                              <td>
                                {uploadingDocId === setup._id ? (
                                  <span style={{ color: '#2F5597', fontSize: '12px' }}>Uploading...</span>
                                ) : uploaded ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                    <a href={uploaded.fileContent} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ fontSize: '11px', padding: '2px 6px', color: '#2b6cb0', textDecoration: 'none', border: '1px solid #2b6cb0', borderRadius: '4px' }}>Preview</a>
                                    <a href={uploaded.fileContent} download={uploaded.fileName} className="icon-btn" style={{ fontSize: '11px', padding: '2px 6px', color: '#2b6cb0', textDecoration: 'none', border: '1px solid #2b6cb0', borderRadius: '4px' }}>Download</a>
                                    <label style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', color: '#d97706', margin: 0, border: '1px solid #d97706', borderRadius: '4px' }}>
                                      Replace
                                      <input type="file" style={{ display: 'none' }} onChange={(e) => handleDocUpload(e, setup)} />
                                    </label>
                                    <button type="button" className="icon-btn" style={{ color: '#C00000', fontSize: '11px', padding: '2px 6px', border: '1px solid #C00000', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} onClick={() => handleDocDelete(uploaded._id)}>Delete</button>
                                    
                                    {/* Verification Actions */}
                                    {uploaded.verificationStatus !== 'Approved' && (
                                      <button type="button" className="icon-btn" style={{ color: '#38a169', fontSize: '11px', padding: '2px 6px', border: '1px solid #38a169', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} onClick={() => handleVerify(uploaded._id, 'Approved')}>Approve</button>
                                    )}
                                    {uploaded.verificationStatus !== 'Rejected' && (
                                      <button type="button" className="icon-btn" style={{ color: '#e53e3e', fontSize: '11px', padding: '2px 6px', border: '1px solid #e53e3e', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} onClick={() => handleVerify(uploaded._id, 'Rejected')}>Reject</button>
                                    )}
                                  </div>
                                ) : setup.allowUpload ? (
                                  <input 
                                    type="file" 
                                    style={{ width: '180px', fontSize: '12px' }} 
                                    onChange={(e) => handleDocUpload(e, setup)}
                                  />
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#7F7F7F' }}>Upload via Admin</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Upload Custom Document */}
                    <div style={{ marginTop: '20px', padding: '16px', background: '#f5f7fa', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#334155' }}>➕ Add Additional Document</h4>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Document Name (e.g., Sports Certificate)" 
                          value={customDocName}
                          onChange={(e) => setCustomDocName(e.target.value)}
                          style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <input 
                          id="customFileInput"
                          type="file" 
                          onChange={(e) => setCustomFile(e.target.files[0])}
                          style={{ fontSize: '13px' }}
                        />
                        <button 
                          type="button" 
                          onClick={handleCustomDocUpload}
                          className="primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Upload
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. CERTIFICATES */}
                {activeTab === 9 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Certificate ID</th>
                          <th>Type</th>
                          <th>Serial No</th>
                          <th>Issue Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certificates.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center' }}>No certificates found.</td></tr>
                        ) : (
                          certificates.map(c => (
                            <tr key={c._id}>
                              <td>{c.certificateId}</td>
                              <td>{c.type}</td>
                              <td>{c.serialNumber}</td>
                              <td>{new Date(c.issueDate).toLocaleDateString()}</td>
                              <td><span className={`badge ${c.status === 'Issued' ? 'active' : 'inactive'}`}>{c.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 10. APPLICATIONS */}
                {activeTab === 10 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>App ID</th>
                          <th>Type</th>
                          <th>Applied On</th>
                          <th>Status</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center' }}>No applications found.</td></tr>
                        ) : (
                          applications.map(a => (
                            <tr key={a._id}>
                              <td>{a.applicationId}</td>
                              <td>{a.type}</td>
                              <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                              <td>
                                <span className={`badge ${a.status === 'Approved' ? 'active' : a.status === 'Rejected' ? 'inactive' : 'pending'}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td>{a.details}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 11. ATTENDANCE */}
                {activeTab === 11 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center' }}>No attendance records found.</td></tr>
                        ) : (
                          attendance.map(a => (
                            <tr key={a._id}>
                              <td>{new Date(a.date).toLocaleDateString()}</td>
                              <td>
                                <span className={`badge ${a.status === 'Present' ? 'active' : 'inactive'}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td>{a.remarks || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 12. PROMOTION HISTORY */}
                {activeTab === 12 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Promotion Date</th>
                          <th>From Sem</th>
                          <th>To Sem</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotions.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center' }}>No promotion history found.</td></tr>
                        ) : (
                          promotions.map(p => (
                            <tr key={p._id}>
                              <td>{new Date(p.promotionDate).toLocaleDateString()}</td>
                              <td>{p.previousSemester}</td>
                              <td>{p.newSemester}</td>
                              <td>{p.promotionStatus}</td>
                              <td>{p.remarks || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 13. PASSING REMARKS */}
                {activeTab === 13 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Remark Date</th>
                          <th>Remark</th>
                          <th>Added By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remarks.length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center' }}>No passing remarks found.</td></tr>
                        ) : (
                          remarks.map(r => (
                            <tr key={r._id}>
                              <td>{new Date(r.remarkDate).toLocaleDateString()}</td>
                              <td>{r.passingRemark}</td>
                              <td>{r.remarkBy}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {isEditing && activeTab <= 7 && (
                  <div className="btn-container" style={{ marginTop: '24px' }}>
                    <button type="submit" className="primary">💾 Save Changes</button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
