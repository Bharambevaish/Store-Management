import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';

export default function StudentPromotion() {
  const canEdit = true; // Enabled for all users in this module for testing

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'rollNumber', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 15;
  const [selectedIds, setSelectedIds] = useState([]);

  const [individualModal, setIndividualModal] = useState({ show: false, student: null });
  const [historyModal, setHistoryModal] = useState({ show: false, data: [], studentName: '' });
  const [previewModal, setPreviewModal] = useState(false);
  const [feeStructureInput, setFeeStructureInput] = useState('');
  const [sourceType, setSourceType] = useState('studentInfo');

  const [filters, setFilters] = useState({
    academicYear: '',
    admissionYear: '',
    department: '',
    course: '',
    branch: '',
    semester: '',
    division: '',
    section: '',
    batch: '',
    admissionType: '',
    category: '',
    gender: '',
    studentStatus: 'Active'
  });

  const [promotionData, setPromotionData] = useState({
    targetAcademicYear: '',
    targetAdmissionYear: '',
    targetSemester: '',
    targetYear: '',
    targetDivision: '',
    targetSection: '',
    targetBatch: '',
    targetCourse: '',
    targetDepartment: '',
    promotionType: 'Semester Promotion',
    promotionStatus: 'Promote',
    promotionDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const MODULE_GROUPS = [
    {
      group: 'Student Information',
      modules: [
        'Demo Institute',
        'Student Portal',
        'Student Login Portal',
        'ID Card Generator',
        'Document Management',
        'Feedback Management',
        'Grievance Redressal',
        'Suggestions Management'
      ]
    },
    {
      group: 'Academic',
      modules: [
        'Attendance Management',
        'Learning Material',
        'Syllabus Coverage',
        'Teacher Guardian',
        'Learning Management System (LMS)',
        'Outcome Based Education (OBE)'
      ]
    },
    {
      group: 'Examination',
      modules: [
        'Online Examination',
        'Examination Management',
        'Result Analysis',
        'Report Card',
        'Entrance Examination'
      ]
    },
    {
      group: 'Accounts',
      modules: ['Fees Collection System', 'Account Management']
    },
    {
      group: 'Human Resource',
      modules: [
        'Faculty Information',
        'Recruitment Management',
        'Leave Management',
        'Payroll Management',
        'Work Compliance'
      ]
    },
    {
      group: 'Administration',
      modules: [
        'Administrative Office',
        'E-Notice System',
        'System Administrator',
        'Authority Portal'
      ]
    },
    {
      group: 'Other ERP Modules',
      modules: [
        'Store Management',
        'Online Admission',
        'Website Management',
        'Hostel Management',
        'Transport Management',
        'Library Management',
        'Alumni Information',
        'Alumni Portal',
        'Training and Placement'
      ]
    }
  ];

  const allModuleNames = MODULE_GROUPS.flatMap(g => g.modules);

  const [moduleSync, setModuleSync] = useState(
    Object.fromEntries(allModuleNames.map(m => [m, false]))
  );

  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [courses, setCourses] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);

  useEffect(() => {
    fetchCourses();
    fetchFeeStructures();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Courses fetch error:', err);
    }
  };

  const fetchFeeStructures = async () => {
    try {
      const res = await api.get('/fee-structures');
      setFeeStructures(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fee structures fetch error:', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setFetchError('');
    setStudents([]);
    setSelectedIds([]);
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val && val.toString().trim()) query.append(key, val.toString().trim());
      });
      const res = await api.get('/students?' + query.toString());
      // Handle both { students: [...] } and plain array responses
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && Array.isArray(res.data.students)) {
        list = res.data.students;
      } else if (res.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      }
      setStudents(list);
      if (list.length === 0) {
        setFetchError('No students found. Try using fewer filters or select different values.');
      }
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.error)
        ? err.response.data.error
        : (err.message || 'Failed to fetch students.');
      setFetchError(msg);
      triggerAlert('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters(Object.assign({}, filters, { [e.target.name]: e.target.value }));
  };

  const resetFilters = () => {
    setFilters({
      academicYear: '', admissionYear: '', department: '', course: '',
      branch: '', semester: '', division: '', section: '', batch: '',
      admissionType: '', category: '', gender: '', studentStatus: 'Active'
    });
    setStudents([]);
    setSelectedIds([]);
    setFetchError('');
  };

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? currentStudents.map(s => s._id) : []);
  };

  const handleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds(selectedIds.concat([id]));
    }
  };

  const handlePromotionChange = (e) => {
    setPromotionData(Object.assign({}, promotionData, { [e.target.name]: e.target.value }));
  };

  const handleModuleSyncChange = (e) => {
    setModuleSync(Object.assign({}, moduleSync, { [e.target.name]: e.target.checked }));
  };

  const selectAllModules = () => {
    setModuleSync(Object.fromEntries(allModuleNames.map(m => [m, true])));
  };

  const clearAllModules = () => {
    setModuleSync(Object.fromEntries(allModuleNames.map(m => [m, false])));
  };

  const executeBulkPromotion = async () => {
    if (!canEdit) { triggerAlert('error', 'You do not have permission.'); return; }
    if (selectedIds.length === 0) { triggerAlert('error', 'Please select at least one student.'); return; }
    if (!promotionData.promotionStatus) { triggerAlert('error', 'Promotion Status is required.'); return; }

    setPreviewModal(false);
    try {
      const payload = Object.assign({}, promotionData, {
        studentIds: selectedIds,
        syncModules: moduleSync
      });
      if (feeStructureInput) payload.feeStructure = feeStructureInput;
      const res = await api.post('/promotions/bulk', payload);
      const msg = (res.data && res.data.message)
        ? res.data.message
        : 'Promotion completed for ' + selectedIds.length + ' student(s). Modules synchronized.';
      triggerAlert('success', msg);
      setPromotionData({
        targetAcademicYear: '', targetAdmissionYear: '', targetSemester: '',
        targetYear: '', targetDivision: '', targetSection: '', targetBatch: '',
        targetCourse: '', targetDepartment: '', promotionType: 'Semester Promotion',
        promotionStatus: 'Promote', promotionDate: new Date().toISOString().split('T')[0], remarks: ''
      });
      setSelectedIds([]);
      fetchStudents();
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.error)
        ? err.response.data.error
        : 'Failed to process promotions.';
      triggerAlert('error', msg);
    }
  };

  const viewHistory = async (student) => {
    try {
      const res = await api.get('/promotions/history/' + student._id);
      setHistoryModal({ show: true, data: res.data, studentName: student.firstName + ' ' + student.lastName });
    } catch (err) {
      triggerAlert('error', 'Failed to load promotion history.');
    }
  };

  const exportExcel = () => {
    if (sortedStudents.length === 0) { triggerAlert('error', 'No students to export.'); return; }
    const data = sortedStudents.map(s => ({
      'Student ID': s.studentId, 'Admission No': s.admissionNumber,
      'Roll No': s.rollNumber, 'Name': s.firstName + ' ' + s.lastName,
      'Department': s.department, 'Course': s.course, 'Semester': s.semester,
      'Division': s.division, 'Academic Year': s.academicYear, 'Status': s.studentStatus
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'Promotion_Students.xlsx');
  };

  const handleSort = (key) => {
    setSortConfig({
      key: key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const filteredStudents = students.filter(function(s) {
    if (search === '') return true;
    const q = search.toLowerCase();
    return (
      ((s.firstName || '') + ' ' + (s.lastName || '')).toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.rollNumber || '').toLowerCase().includes(q) ||
      (s.admissionNumber || '').toLowerCase().includes(q) ||
      (s.prn || '').toLowerCase().includes(q)
    );
  });

  const sortedStudents = filteredStudents.slice().sort(function(a, b) {
    const av = (a[sortConfig.key] || '').toString().toLowerCase();
    const bv = (b[sortConfig.key] || '').toString().toLowerCase();
    if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
    if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedStudents.length / studentsPerPage);
  const indexOfFirst = (currentPage - 1) * studentsPerPage;
  const currentStudents = sortedStudents.slice(indexOfFirst, indexOfFirst + studentsPerPage);
  const selectedModulesCount = Object.values(moduleSync).filter(Boolean).length;

  // ─── Styles ───
  const card = { background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
  const badgeStyle = { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2F5597', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 };
  const inputStyle = { padding: '7px 10px', border: '1px solid #cdd5e0', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '600', color: '#444', marginBottom: '4px', display: 'block' };
  const fieldBox = { display: 'flex', flexDirection: 'column' };
  const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#2F5597', whiteSpace: 'nowrap', fontSize: '13px' };
  const tdStyle = { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f0f0f0' };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>

      {/* Alert */}
      {alert.show && (
        <div style={{ padding: '12px 18px', marginBottom: '20px', borderRadius: '6px', color: '#fff', fontWeight: '500', fontSize: '14px', backgroundColor: alert.type === 'success' ? '#1a7f4e' : '#c0392b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {alert.type === 'success' ? '[OK]' : '[!]'} {alert.message}
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a2f5a', fontSize: '22px', fontWeight: '700' }}>Student Promotion</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>Filter students, select them, configure promotion settings, then promote in bulk across ERP modules.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportExcel} style={{ padding: '7px 16px', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444' }}>Excel Export</button>
        </div>
      </div>

      {/* ── STEP 1: FILTER ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={badgeStyle}>1</div>
          <h3 style={{ margin: 0, color: '#1a2f5a', fontSize: '16px', fontWeight: '600' }}>Filter Students</h3>
        </div>

        {/* Source Type */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', padding: '10px 14px', background: '#f4f6fb', borderRadius: '8px', border: '1px solid #e0e5f0', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: sourceType === 'studentInfo' ? '700' : '400', color: sourceType === 'studentInfo' ? '#2F5597' : '#555' }}>
            <input type="radio" name="sourceType" value="studentInfo" checked={sourceType === 'studentInfo'} onChange={function(e) { setSourceType(e.target.value); setStudents([]); setSelectedIds([]); }} />
            Student Information
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: sourceType === 'feeCollection' ? '700' : '400', color: sourceType === 'feeCollection' ? '#2F5597' : '#555' }}>
            <input type="radio" name="sourceType" value="feeCollection" checked={sourceType === 'feeCollection'} onChange={function(e) { setSourceType(e.target.value); setStudents([]); setSelectedIds([]); }} />
            Fee Collection
          </label>
        </div>

        {/* Filter Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '12px', marginBottom: '18px' }}>

          <div style={fieldBox}>
            <label style={labelStyle}>Academic Year *</label>
            <select name="academicYear" value={filters.academicYear} onChange={handleFilterChange} style={inputStyle}>
              <option value="">-- Select --</option>
              {['2024-25','2025-26','2026-27','2022-2023','2023-2024','2024-2025','2025-2026','2026-2027'].map(function(y) { return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Course</label>
            <select name="course" value={filters.course} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {courses.map(function(c) { return <option key={c._id} value={c.name}>{c.name}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Admission Year</label>
            <select name="admissionYear" value={filters.admissionYear} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {['2026','2025','2024','2023','2022','2021','2020','2019'].map(function(y) { return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Department</label>
            <select name="department" value={filters.department} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {['Computer Engineering','Information Technology','Mechanical','Civil','Electronics','Electrical','Chemical'].map(function(d) { return <option key={d} value={d}>{d}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Semester</label>
            <select name="semester" value={filters.semester} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {[1,2,3,4,5,6,7,8].map(function(s) { return <option key={s} value={'Semester ' + s}>Semester {s}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Division / Class</label>
            <select name="division" value={filters.division} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {['A','B','C','D','First Year','Second Year','Third Year','Fourth Year'].map(function(d) { return <option key={d} value={d}>{d}</option>; })}
            </select>
          </div>



          <div style={fieldBox}>
            <label style={labelStyle}>Admission Type</label>
            <select name="admissionType" value={filters.admissionType} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {['CAP','Management','TFWS','Regular','Lateral','Institute Level','NRI'].map(function(t) { return <option key={t} value={t}>{t}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Category</label>
            <select name="category" value={filters.category} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              {['Open','OBC','SC','ST','NT','EWS','General','VJNT'].map(function(c) { return <option key={c} value={c}>{c}</option>; })}
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Gender</label>
            <select name="gender" value={filters.gender} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Student Status</label>
            <select name="studentStatus" value={filters.studentStatus} onChange={handleFilterChange} style={inputStyle}>
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Alumni">Alumni</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={fetchStudents}
            disabled={loading}
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: '700', backgroundColor: '#2F5597', border: 'none', color: '#fff', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Loading...' : 'Fetch Students'}
          </button>

          <button
            onClick={resetFilters}
            style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', color: '#555' }}
          >
            Reset Filters
          </button>



          {students.length > 0 && !loading && (
            <span style={{ fontSize: '13px', color: '#1a7f4e', fontWeight: '600', marginLeft: 'auto' }}>
              {students.length} student{students.length !== 1 ? 's' : ''} loaded
            </span>
          )}
        </div>

        {/* Fetch Error */}
        {fetchError && (
          <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', color: '#856404', fontSize: '13px' }}>
            {fetchError}
          </div>
        )}
      </div>

      {/* ── STEP 2: STUDENT TABLE ──────────────────────────────────── */}
      {students.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div style={badgeStyle}>2</div>
            <h3 style={{ margin: 0, color: '#1a2f5a', fontSize: '16px', fontWeight: '600' }}>Select Students</h3>
            <span style={{ marginLeft: 'auto', fontSize: '13px', color: selectedIds.length > 0 ? '#2F5597' : '#888', fontWeight: selectedIds.length > 0 ? '700' : '400' }}>
              {selectedIds.length > 0 ? 'Selected: ' + selectedIds.length + ' / ' + sortedStudents.length : 'Use checkboxes to select students'}
            </span>
          </div>

          <div style={{ marginBottom: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by Name, ID, Roll No, Admission No..."
              value={search}
              onChange={function(e) { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ padding: '8px 12px', border: '1px solid #cdd5e0', borderRadius: '6px', fontSize: '13px', width: '320px', maxWidth: '100%' }}
            />
            {selectedIds.length > 0 && (
              <button onClick={function() { setSelectedIds([]); }} style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e74c3c', borderRadius: '4px', color: '#e74c3c', background: '#fff7f7', cursor: 'pointer' }}>
                Clear Selection
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1000px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f4f6fb', borderBottom: '2px solid #dde3f0' }}>
                  <th style={{ padding: '10px', textAlign: 'center', width: '40px' }}>
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={currentStudents.length > 0 && currentStudents.every(function(s) { return selectedIds.includes(s._id); })}
                    />
                  </th>
                  {[['studentId','Student ID'],['firstName','Name'],['admissionNumber','Adm. No'],['rollNumber','Roll No'],['department','Department'],['course','Course'],['semester','Semester'],['division','Division'],['academicYear','Academic Year'],['studentStatus','Status']].map(function(pair) {
                    return (
                      <th key={pair[0]} onClick={function() { handleSort(pair[0]); }} style={{ ...thStyle, cursor: 'pointer' }}>
                        {pair[1]}{sortConfig.key === pair[0] ? (sortConfig.direction === 'asc' ? ' ^' : ' v') : ''}
                      </th>
                    );
                  })}
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.map(function(s, i) {
                  const isSelected = selectedIds.includes(s._id);
                  return (
                    <tr key={s._id} style={{ backgroundColor: isSelected ? '#eef4ff' : (i % 2 === 0 ? '#fff' : '#fafbfe'), transition: 'background 0.1s' }}>
                      <td style={{ textAlign: 'center', padding: '10px' }}>
                        <input type="checkbox" checked={isSelected} onChange={function() { handleSelect(s._id); }} />
                      </td>
                      <td style={tdStyle}><span style={{ fontWeight: '600', color: '#2F5597' }}>{s.studentId || '-'}</span></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: '600' }}>{s.firstName} {s.lastName}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{s.gender || '-'} | {s.category || '-'}</div>
                      </td>
                      <td style={tdStyle}>{s.admissionNumber || '-'}</td>
                      <td style={tdStyle}>{s.rollNumber || '-'}</td>
                      <td style={tdStyle}>{s.department || '-'}</td>
                      <td style={tdStyle}>{s.course || '-'}</td>
                      <td style={tdStyle}>{s.semester || '-'}</td>
                      <td style={tdStyle}>{s.division || '-'}</td>
                      <td style={tdStyle}>
                        <div>{s.academicYear || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{s.admissionYear || ''}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: s.studentStatus === 'Active' ? '#e6f4ea' : s.studentStatus === 'Alumni' ? '#fff3e0' : '#fdecea',
                          color: s.studentStatus === 'Active' ? '#1e7e34' : s.studentStatus === 'Alumni' ? '#e65100' : '#c0392b'
                        }}>
                          {s.studentStatus}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={function() { setIndividualModal({ show: true, student: s }); }} style={{ fontSize: '11px', padding: '3px 8px', background: '#fff3e0', border: '1px solid #ffcc80', color: '#e65100', borderRadius: '4px', cursor: 'pointer' }}>Promote</button>
                          <button onClick={function() { viewHistory(s); }} style={{ fontSize: '11px', padding: '3px 8px', background: '#e8f0fe', border: '1px solid #90caf9', color: '#2b6cb0', borderRadius: '4px', cursor: 'pointer' }}>History</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {currentStudents.length === 0 && (
                  <tr><td colSpan={canEdit ? 12 : 11} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>No students match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '16px', gap: '12px' }}>
              <button onClick={function() { setCurrentPage(function(p) { return Math.max(p - 1, 1); }); }} disabled={currentPage === 1} style={{ padding: '6px 16px', borderRadius: '5px', border: '1px solid #ccc', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: currentPage === 1 ? 0.5 : 1 }}>Prev</button>
              <span style={{ fontSize: '13px', color: '#555' }}>Page {currentPage} of {totalPages} ({sortedStudents.length} total)</span>
              <button onClick={function() { setCurrentPage(function(p) { return Math.min(p + 1, totalPages); }); }} disabled={currentPage === totalPages} style={{ padding: '6px 16px', borderRadius: '5px', border: '1px solid #ccc', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {students.length > 0 && selectedIds.length === 0 && (
        <div style={{ background: '#fff8e1', border: '1px dashed #f5a623', borderRadius: '8px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#7d4e00', fontSize: '14px' }}>Select students to proceed</div>
            <div style={{ color: '#9e6300', fontSize: '13px', marginTop: '2px' }}>Check the boxes in the table above. The promotion configuration panel will appear below.</div>
          </div>
        </div>
      )}

      {/* ── STEP 3: PROMOTION PANEL ─────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div style={{ ...card, border: '2px solid #2F5597', boxShadow: '0 2px 12px rgba(47,85,151,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
            <div style={badgeStyle}>3</div>
            <h3 style={{ margin: 0, color: '#1a2f5a', fontSize: '16px', fontWeight: '600' }}>
              Bulk Promotion {'— '}<span style={{ color: '#2F5597' }}>{selectedIds.length} Student{selectedIds.length > 1 ? 's' : ''} Selected</span>
            </h3>
          </div>

          {/* A: Promotion Details */}
          <div style={{ background: '#f8faff', border: '1px solid #dde3f0', borderRadius: '8px', padding: '18px', marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 14px', color: '#2F5597', fontSize: '14px', fontWeight: '700' }}>Promotion Configuration</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Promotion Type', name: 'promotionType', type: 'select', options: ['Semester Promotion','Year Promotion','Department Transfer','Course Transfer','Class Transfer'] },
                { label: 'Promotion Status', name: 'promotionStatus', type: 'select', options: ['Promote','Repeat Semester','Detain','Alumni','Dropout'] },
                { label: 'Target Academic Year', name: 'targetAcademicYear', type: 'text', placeholder: 'e.g. 2026-2027' },
                { label: 'Target Semester', name: 'targetSemester', type: 'select', options: ['','Semester 1','Semester 2','Semester 3','Semester 4','Semester 5','Semester 6','Semester 7','Semester 8'] },
                { label: 'Target Year (FY/SY/TY)', name: 'targetYear', type: 'text', placeholder: 'e.g. Second Year' },
                { label: 'Target Division', name: 'targetDivision', type: 'text', placeholder: 'e.g. A' },
                { label: 'Target Course (if transfer)', name: 'targetCourse', type: 'text', placeholder: 'e.g. B.Tech' },
                { label: 'Target Department (if transfer)', name: 'targetDepartment', type: 'text', placeholder: 'e.g. Computer Eng' },
                { label: 'Promotion Date', name: 'promotionDate', type: 'date', placeholder: '' },
              ].map(function(f) {
                return (
                  <div key={f.name} style={fieldBox}>
                    <label style={labelStyle}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select name={f.name} value={promotionData[f.name]} onChange={handlePromotionChange} style={inputStyle}>
                        {f.options.map(function(o) { return <option key={o} value={o}>{o || 'Keep Current'}</option>; })}
                      </select>
                    ) : (
                      <input type={f.type} name={f.name} value={promotionData[f.name]} onChange={handlePromotionChange} placeholder={f.placeholder} style={inputStyle} />
                    )}
                  </div>
                );
              })}
              <div style={{ ...fieldBox, gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks / Notes</label>
                <input name="remarks" value={promotionData.remarks} onChange={handlePromotionChange} placeholder="e.g. Promoted after successful completion of Semester 3" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* B: Module Forwarding */}
          <div style={{ background: '#f8faff', border: '1px solid #dde3f0', borderRadius: '8px', padding: '18px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, color: '#2F5597', fontSize: '14px', fontWeight: '700' }}>Forward Student Data To ERP Modules</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={selectAllModules} style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid #2F5597', borderRadius: '4px', color: '#2F5597', background: '#fff', cursor: 'pointer' }}>Select All</button>
                <button onClick={clearAllModules} style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid #ccc', borderRadius: '4px', color: '#555', background: '#fff', cursor: 'pointer' }}>Clear All</button>
                <span style={{ fontSize: '12px', color: '#555', padding: '4px 8px', background: '#eef4ff', borderRadius: '4px', border: '1px solid #b3cdf7' }}>{selectedModulesCount} selected</span>
              </div>
            </div>

            {MODULE_GROUPS.map(function(group) {
              return (
                <div key={group.group} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e0e5f0', paddingBottom: '4px' }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {group.modules.map(function(mod) {
                      return (
                        <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333', padding: '6px 10px', borderRadius: '5px', backgroundColor: moduleSync[mod] ? '#eef4ff' : '#fff', border: '1px solid ' + (moduleSync[mod] ? '#b3cdf7' : '#e0e5f0'), transition: 'all 0.1s' }}>
                          <input type="checkbox" name={mod} checked={moduleSync[mod] || false} onChange={handleModuleSyncChange} style={{ cursor: 'pointer' }} />
                          {mod}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* C: Fee Structure */}
          <div style={{ background: '#f8faff', border: '1px solid #dde3f0', borderRadius: '8px', padding: '18px', marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#2F5597', fontSize: '14px', fontWeight: '700' }}>Allot Fee Structure (Optional)</h4>
            <div style={{ ...fieldBox, maxWidth: '360px' }}>
              <label style={labelStyle}>Select Fee Structure</label>
              <select value={feeStructureInput} onChange={function(e) { setFeeStructureInput(e.target.value); }} style={inputStyle}>
                <option value="">-- None (Skip Fee Allotment) --</option>
                {feeStructures.map(function(f) { return <option key={f._id} value={f._id}>{f.name || f.title || f._id}</option>; })}
              </select>
            </div>
          </div>

          {/* D: Execute */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px', background: '#1a2f5a', borderRadius: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>
                Ready to promote {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''}
              </div>
              <div style={{ color: '#8fa8d0', fontSize: '12px', marginTop: '4px' }}>
                {promotionData.targetSemester ? 'To: ' + promotionData.targetSemester : ''}
                {promotionData.targetAcademicYear ? ' | AY: ' + promotionData.targetAcademicYear : ''}
                {' | ' + selectedModulesCount + ' module' + (selectedModulesCount !== 1 ? 's' : '') + ' selected'}
                {' | ' + promotionData.promotionType}
              </div>
            </div>
            <button
              onClick={function() { setPreviewModal(true); }}
              style={{ padding: '11px 24px', fontSize: '14px', fontWeight: '700', backgroundColor: '#e0e9ff', color: '#1a2f5a', border: 'none', borderRadius: '7px', cursor: 'pointer' }}
            >
              Preview Summary
            </button>
            <button
              onClick={executeBulkPromotion}
              style={{ padding: '11px 28px', fontSize: '15px', fontWeight: '700', backgroundColor: '#f5a623', color: '#1a2f5a', border: 'none', borderRadius: '7px', cursor: 'pointer' }}
            >
              Promote &amp; Synchronize
            </button>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────────── */}
      {previewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '540px', maxHeight: '80vh', overflowY: 'auto', padding: '28px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#1a2f5a', fontSize: '18px' }}>Promotion Preview</h3>
            {[
              ['Students Selected', selectedIds.length],
              ['Promotion Type', promotionData.promotionType],
              ['Status', promotionData.promotionStatus],
              ['Current Filters', 'AY: ' + (filters.academicYear || 'Any') + ', Sem: ' + (filters.semester || 'Any')],
              ['Target Academic Year', promotionData.targetAcademicYear || '(no change)'],
              ['Target Semester', promotionData.targetSemester || '(no change)'],
              ['Target Division', promotionData.targetDivision || '(no change)'],
              ['Modules Selected', selectedModulesCount + ' of ' + allModuleNames.length],
              ['Fee Structure', feeStructureInput ? 'Yes' : 'None'],
              ['Promotion Date', promotionData.promotionDate],
              ['Remarks', promotionData.remarks || '-'],
            ].map(function(row) {
              return (
                <div key={row[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                  <span style={{ color: '#555', fontWeight: '500' }}>{row[0]}</span>
                  <span style={{ color: '#1a2f5a', fontWeight: '700' }}>{row[1]}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={function() { setPreviewModal(false); }} style={{ padding: '9px 20px', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#555' }}>Cancel</button>
              <button onClick={executeBulkPromotion} style={{ padding: '9px 24px', border: 'none', borderRadius: '6px', background: '#2F5597', cursor: 'pointer', fontSize: '14px', color: '#fff', fontWeight: '700' }}>Confirm &amp; Promote</button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ─────────────────────────────────────────── */}
      {historyModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '800px', maxHeight: '80vh', overflowY: 'auto', padding: '24px', boxShadow: '0 4px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#2F5597' }}>Promotion History</h3>
              <button style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#555', lineHeight: 1 }} onClick={function() { setHistoryModal({ show: false, data: [], studentName: '' }); }}>x</button>
            </div>
            <h4 style={{ marginBottom: '16px', color: '#333' }}>{historyModal.studentName}</h4>
            {historyModal.data.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No previous promotion records found for this student.</div>
            ) : (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f4f6fb' }}>
                    {['Date','Type','Previous','New','By'].map(function(h) {
                      return <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#2F5597', borderBottom: '2px solid #dde3f0' }}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {historyModal.data.map(function(h) {
                    return (
                      <tr key={h._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(h.promotionDate).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '10px 12px' }}><strong>{h.status}</strong></td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#555' }}>AY: {h.prevAcademicYear}<br />Sem: {h.prevSemester}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#555' }}>AY: {h.newAcademicYear}<br />Sem: {h.newSemester}</td>
                        <td style={{ padding: '10px 12px' }}>{h.performedBy || 'System'}{h.remarks && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{h.remarks}</div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Individual Promotion Modal ────────────────────────────── */}
      {individualModal.show && individualModal.student && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 4px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', color: '#2F5597', fontSize: '16px' }}>Promote Individual Student</h3>
            <div style={{ background: '#f4f6fb', borderRadius: '6px', padding: '12px 14px', marginBottom: '18px', fontSize: '13px', color: '#444' }}>
              <strong>{individualModal.student.firstName} {individualModal.student.lastName}</strong> ({individualModal.student.studentId})<br />
              <span style={{ color: '#777', fontSize: '12px' }}>
                Current: {individualModal.student.academicYear} | {individualModal.student.semester} | Div: {individualModal.student.division}-{individualModal.student.section}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
              <label style={labelStyle}>Target Academic Year</label>
              <input type="text" id="indiv_ay" defaultValue={individualModal.student.academicYear || ''} placeholder="Target Academic Year" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ ...fieldBox, flex: 1 }}>
                <label style={labelStyle}>Target Semester</label>
                <select id="indiv_sem" defaultValue={individualModal.student.semester} style={inputStyle}>
                  {[1,2,3,4,5,6,7,8].map(function(s) { return <option key={s} value={'Semester ' + s}>Semester {s}</option>; })}
                </select>
              </div>
              <div style={{ ...fieldBox, flex: 1 }}>
                <label style={labelStyle}>Promotion Status</label>
                <select id="indiv_status" style={inputStyle}>
                  <option value="Promote">Promote</option>
                  <option value="Repeat Semester">Repeat Semester</option>
                  <option value="Detain">Detain</option>
                  <option value="Alumni">Alumni</option>
                  <option value="Dropout">Dropout</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ ...fieldBox, flex: 1 }}>
                <label style={labelStyle}>Division</label>
                <input type="text" id="indiv_div" defaultValue={individualModal.student.division || ''} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
              <label style={labelStyle}>Remarks</label>
              <input type="text" id="indiv_rem" placeholder="Remarks" style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <button style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#555' }} onClick={function() { setIndividualModal({ show: false, student: null }); }}>Cancel</button>
              <button style={{ padding: '8px 22px', borderRadius: '6px', border: 'none', background: '#2F5597', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }} onClick={async function() {
                const payload = {
                  targetAcademicYear: document.getElementById('indiv_ay').value,
                  targetSemester: document.getElementById('indiv_sem').value,
                  targetDivision: document.getElementById('indiv_div').value,
                  promotionStatus: document.getElementById('indiv_status').value,
                  remarks: document.getElementById('indiv_rem').value,
                  promotionDate: new Date().toISOString().split('T')[0],
                  syncModules: moduleSync
                };
                try {
                  await api.post('/promotions/' + individualModal.student._id, payload);
                  triggerAlert('success', 'Student promoted successfully!');
                  setIndividualModal({ show: false, student: null });
                  fetchStudents();
                } catch (e) {
                  const msg = (e.response && e.response.data && e.response.data.error) ? e.response.data.error : 'Promotion failed.';
                  triggerAlert('error', msg);
                }
              }}>Save &amp; Promote</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
