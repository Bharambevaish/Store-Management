import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function PassingRemark() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  
  const [filters, setFilters] = useState({
    academicYear: '',
    admissionYear: '',
    department: '',
    course: '',
    semester: '',
    division: '',
    batch: '',
    section: '',
    studentStatus: 'Active',
    gender: ''
  });

  const [bulkData, setBulkData] = useState({
    passingRemark: '',
    effectiveAcademicYear: '',
    remarkDate: new Date().toISOString().split('T')[0],
    additionalNotes: ''
  });

  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [historyModal, setHistoryModal] = useState({ show: false, data: [], studentName: '' });

  // Dropdown data options
  const [courses, setCourses] = useState([]);
  
  useEffect(() => {
    fetchCourses();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      if (Array.isArray(res.data)) {
        // Extract unique course names to prevent duplicates
        const uniqueNames = [...new Set(res.data.map(c => c.name))];
        setCourses(uniqueNames.map(n => ({ _id: n, name: n })));
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setCourses([{ _id: 'B.Tech', name: 'B.Tech' }, { _id: 'M.Tech', name: 'M.Tech' }, { _id: 'Diploma', name: 'Diploma' }]);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) query.append(key, filters[key]);
      });
      const res = await api.get(`/students?${query.toString()}`);
      setStudents(res.data.students || []);
      setSelectedIds([]); // reset selection
    } catch (err) {
      triggerAlert('error', 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const resetFilters = () => {
    setFilters({
      academicYear: '',
      admissionYear: '',
      department: '',
      course: '',
      semester: '',
      division: '',
      batch: '',
      section: '',
      studentStatus: 'Active',
      gender: ''
    });
    setStudents([]);
    setSelectedIds([]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredStudents.map(s => s._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selId => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkChange = (e) => {
    setBulkData({ ...bulkData, [e.target.name]: e.target.value });
  };

  const saveSelected = () => {
    if (selectedIds.length === 0) return triggerAlert('error', 'No students selected');
    executeBulkSave(selectedIds);
  };

  const saveAllFiltered = () => {
    if (filteredStudents.length === 0) return triggerAlert('error', 'No students to update');
    executeBulkSave(filteredStudents.map(s => s._id));
  };

  const executeBulkSave = async (idsToUpdate) => {
    if (!bulkData.passingRemark) return triggerAlert('error', 'Passing Remark is required');
    
    try {
      await api.post('/passing-remarks/bulk', {
        studentIds: idsToUpdate,
        passingRemark: bulkData.passingRemark,
        effectiveAcademicYear: bulkData.effectiveAcademicYear,
        remarkDate: bulkData.remarkDate,
        additionalNotes: bulkData.additionalNotes
      });
      triggerAlert('success', `Remarks updated for ${idsToUpdate.length} students`);
      fetchStudents(); // refresh data
      setBulkData({ ...bulkData, passingRemark: '', additionalNotes: '' });
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save remarks');
    }
  };

  const viewHistory = async (student) => {
    try {
      const res = await api.get(`/passing-remarks/history/${student._id}`);
      setHistoryModal({ show: true, data: res.data, studentName: `${student.firstName} ${student.lastName}` });
    } catch (err) {
      triggerAlert('error', 'Failed to load history');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text('Passing Remarks Report', 14, 15);
    const rows = filteredStudents.map(s => [
      s.studentId, s.rollNumber, `${s.firstName} ${s.lastName}`,
      s.course, s.semester, s.academicYear || '-',
      s.passingRemark || '-', s.remarkDate ? new Date(s.remarkDate).toLocaleDateString() : '-'
    ]);
    doc.autoTable({
      head: [['ID', 'Roll No', 'Name', 'Course', 'Semester', 'Academic Year', 'Passing Remark', 'Remark Date']],
      body: rows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [47, 85, 151] }
    });
    doc.save('Passing_Remarks.pdf');
  };

  const exportExcel = () => {
    const data = filteredStudents.map(s => ({
      'Student ID': s.studentId,
      'Roll Number': s.rollNumber,
      'Name': `${s.firstName} ${s.lastName}`,
      'Course': s.course,
      'Semester': s.semester,
      'Division': s.division,
      'Academic Year': s.academicYear,
      'Current Result': s.passingRemark,
      'Remark Date': s.remarkDate ? new Date(s.remarkDate).toLocaleDateString() : '',
      'Remarks': s.remarks,
      'Status': s.studentStatus
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Passing Remarks");
    XLSX.writeFile(wb, `Passing_Remarks.xlsx`);
  };

  const filteredStudents = students.filter(s => 
    search === '' || 
    s.firstName.toLowerCase().includes(search.toLowerCase()) || 
    s.lastName.toLowerCase().includes(search.toLowerCase()) || 
    s.studentId.toLowerCase().includes(search.toLowerCase()) || 
    s.rollNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert ${alert.type}`} style={{ padding: '12px', marginBottom: '20px', borderRadius: '4px', color: '#fff', backgroundColor: alert.type === 'success' ? '#38a169' : '#e53e3e' }}>
          {alert.message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#2F5597', margin: 0 }}>📋 Bulk Passing Remarks</h2>
      </div>

      {/* Step 1: Filters */}
      <div className="form-card" style={{ marginBottom: '20px' }}>
        <h4 style={{ color: '#595959', margin: '0 0 16px 0' }}>Step 1: Filter Students</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Academic Year *</label>
            <select name="academicYear" value={filters.academicYear} onChange={handleFilterChange}>
              <option value="">All Academic Years</option>
              {['2022-23', '2023-24', '2024-25', '2025-26', '2026-27', '2027-28'].map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Admission Year</label>
            <select name="admissionYear" value={filters.admissionYear} onChange={handleFilterChange}>
              <option value="">All Admission Years</option>
              {['2021', '2022', '2023', '2024', '2025', '2026', '2027'].map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Department *</label>
            <select name="department" value={filters.department} onChange={handleFilterChange}>
              <option value="">Select Department</option>
              <option value="Computer Engineering">Computer Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics">Electronics</option>
              <option value="Civil">Civil</option>
              <option value="Mechanical">Mechanical</option>
            </select>
          </div>
          <div className="form-group">
            <label>Course *</label>
            <select name="course" value={filters.course} onChange={handleFilterChange}>
              <option value="">Select Course</option>
              {courses.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Semester *</label>
            <select name="semester" value={filters.semester} onChange={handleFilterChange}>
              <option value="">Select Semester</option>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Division</label>
            <input name="division" value={filters.division} onChange={handleFilterChange} />
          </div>
          <div className="form-group">
            <label>Batch</label>
            <input name="batch" value={filters.batch} onChange={handleFilterChange} />
          </div>
          <div className="form-group">
            <label>Section</label>
            <input name="section" value={filters.section} onChange={handleFilterChange} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="studentStatus" value={filters.studentStatus} onChange={handleFilterChange}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Alumni">Alumni</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select name="gender" value={filters.gender} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button className="primary" onClick={fetchStudents} disabled={loading}>
            {loading ? 'Loading...' : '🔍 Show Students'}
          </button>
          <button className="secondary" onClick={resetFilters}>Reset Filters</button>
        </div>
      </div>

      {students.length > 0 && (
        <>
          {/* Step 3: Bulk Action Panel */}
          <div className="form-card" style={{ marginBottom: '20px', borderLeft: '4px solid #2b6cb0' }}>
            <h4 style={{ color: '#2b6cb0', margin: '0 0 16px 0' }}>Step 2: Assign Bulk Passing Remark</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Passing Remark *</label>
                <input list="remarks-list" name="passingRemark" value={bulkData.passingRemark} onChange={handleBulkChange} placeholder="e.g. Promoted to Next Semester" />
                <datalist id="remarks-list">
                  <option value="Promoted to Next Semester" />
                  <option value="Eligible for Promotion" />
                  <option value="ATKT" />
                  <option value="Pass" />
                  <option value="Fail" />
                  <option value="Detained" />
                </datalist>
              </div>
              <div className="form-group">
                <label>Effective Academic Year</label>
                <input name="effectiveAcademicYear" value={bulkData.effectiveAcademicYear} onChange={handleBulkChange} placeholder="e.g. 2024-2025" />
              </div>
              <div className="form-group">
                <label>Remark Date</label>
                <input type="date" name="remarkDate" value={bulkData.remarkDate} onChange={handleBulkChange} />
              </div>
              <div className="form-group">
                <label>Remark By (Auto)</label>
                <input type="text" value="System/Admin" disabled style={{ backgroundColor: '#f0f0f0' }} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Additional Remarks</label>
                <input name="additionalNotes" value={bulkData.additionalNotes} onChange={handleBulkChange} placeholder="Add any extra notes here..." />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button className="primary" onClick={saveSelected} style={{ backgroundColor: '#38a169', borderColor: '#38a169' }}>
                💾 Save Selected ({selectedIds.length})
              </button>
              <button className="primary" onClick={saveAllFiltered} style={{ backgroundColor: '#3182ce', borderColor: '#3182ce' }}>
                💾 Save All Filtered ({filteredStudents.length})
              </button>
              <button className="secondary" onClick={() => setBulkData({ passingRemark: '', effectiveAcademicYear: '', remarkDate: new Date().toISOString().split('T')[0], additionalNotes: '' })}>Reset Action</button>
            </div>
          </div>

          {/* Step 2: Student Table */}
          <div className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#595959' }}>Filtered Students</h4>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Search in table..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button className="secondary icon-btn" onClick={exportPDF}>📄 Export PDF</button>
                <button className="secondary icon-btn" onClick={exportExcel}>📊 Export Excel</button>
              </div>
            </div>
            
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '1200px', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0} /></th>
                    <th>ID / Roll No</th>
                    <th>Student Name</th>
                    <th>Course & Sem</th>
                    <th>Div / Batch</th>
                    <th>Current Remark</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s._id} style={{ backgroundColor: selectedIds.includes(s._id) ? '#f0f7ff' : 'transparent' }}>
                      <td><input type="checkbox" checked={selectedIds.includes(s._id)} onChange={() => handleSelect(s._id)} /></td>
                      <td>
                        <strong>{s.studentId}</strong>
                        <div style={{ fontSize: '11px', color: '#7F7F7F' }}>Roll: {s.rollNumber}</div>
                        <div style={{ fontSize: '11px', color: '#7F7F7F' }}>Adm: {s.admissionNumber || '-'}</div>
                      </td>
                      <td><strong>{s.firstName} {s.lastName}</strong></td>
                      <td>
                        {s.course}
                        <div style={{ fontSize: '11px', color: '#7F7F7F' }}>{s.semester}</div>
                        <div style={{ fontSize: '11px', color: '#7F7F7F' }}>AY: {s.academicYear || '-'}</div>
                      </td>
                      <td>
                        Div: {s.division || '-'}
                        <div style={{ fontSize: '11px', color: '#7F7F7F' }}>Batch: {s.batch || '-'}</div>
                      </td>
                      <td>
                        {s.passingRemark ? (
                          <span className="badge active">{s.passingRemark}</span>
                        ) : <span className="badge" style={{ backgroundColor: '#eee', color: '#555' }}>None</span>}
                      </td>
                      <td>
                        <span className={`badge ${s.studentStatus === 'Active' ? 'active' : 'inactive'}`}>
                          {s.studentStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="icon-btn" style={{ fontSize: '12px', color: '#2b6cb0' }} onClick={() => viewHistory(s)}>🕒 History</button>
                          <a href={`/student/${s._id}`} target="_blank" rel="noreferrer" className="icon-btn" style={{ fontSize: '12px', color: '#38a169', textDecoration: 'none' }}>👤 Profile</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#7f7f7f' }}>No students found matching your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* History Modal */}
      {historyModal.show && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content form-card" style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#2F5597' }}>Passing Remark History</h3>
              <button className="icon-btn" style={{ fontSize: '20px' }} onClick={() => setHistoryModal({ show: false, data: [], studentName: '' })}>×</button>
            </div>
            <h4 style={{ marginBottom: '16px' }}>{historyModal.studentName}</h4>
            
            {historyModal.data.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#7f7f7f' }}>No historical remarks found.</div>
            ) : (
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Remark</th>
                    <th>Eff. Academic Year</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal.data.map(h => (
                    <tr key={h._id}>
                      <td>{new Date(h.remarkDate).toLocaleDateString()}</td>
                      <td><strong>{h.passingRemark}</strong></td>
                      <td>{h.effectiveAcademicYear || '-'}</td>
                      <td>{h.remarkBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
