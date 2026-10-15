import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function SubjectDetails() {
  const [activeTab, setActiveTab] = useState('manage');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  // Common dropdown options (mocked to match the ERP style)
  const departments = ['Computer Engineering', 'Information Technology', 'Mechanical', 'Civil', 'Electronics'];
  const courses = ['B.Tech', 'M.Tech', 'Diploma'];
  const semesters = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'];
  const academicYears = ['2023-24', '2024-25', '2025-26', '2026-27'];
  
  // -- STYLES --
  const pageContainer = { padding: '20px', fontFamily: '"Inter", sans-serif', backgroundColor: '#f8f9fc', minHeight: '100vh' };
  const tabContainer = { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #dde3f0', paddingBottom: '10px' };
  const getTabStyle = (tabName) => ({
    padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px',
    backgroundColor: activeTab === tabName ? '#2F5597' : 'transparent',
    color: activeTab === tabName ? '#fff' : '#4a5568',
    border: activeTab === tabName ? 'none' : '1px solid transparent',
    transition: 'all 0.2s ease'
  });
  const cardStyle = { backgroundColor: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '20px' };
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#fcfcfc' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '5px' };
  const fieldBox = { display: 'flex', flexDirection: 'column', gap: '4px' };
  const btnStyle = (bg, color) => ({ padding: '10px 18px', backgroundColor: bg, color, border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' });

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  // ================= TAB 1: MANAGE SUBJECTS =================
  const [subjects, setSubjects] = useState([]);
  const initialSubjectForm = {
    subjectCode: '', name: '', subjectShortName: '', subjectType: 'Theory',
    department: '', course: '', branch: '', semester: '', academicYear: '',
    credits: 0, totalHours: 0, internalMarks: 0, externalMarks: 0, passingMarks: 0, totalMarks: 0, status: 'Active'
  };
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);
  const [editingId, setEditingId] = useState(null);
  
  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch subjects');
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchSubjects();
  }, [activeTab]);

  const handleSubjectChange = (e) => {
    setSubjectForm({ ...subjectForm, [e.target.name]: e.target.value });
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.department || !subjectForm.course || !subjectForm.semester || !subjectForm.academicYear) {
      triggerAlert('error', 'Please fill all required (*) fields.');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/subjects/${editingId}`, subjectForm);
        triggerAlert('success', 'Subject updated successfully!');
      } else {
        await api.post('/subjects', subjectForm);
        triggerAlert('success', 'Subject added successfully!');
      }
      setSubjectForm(initialSubjectForm);
      setEditingId(null);
      fetchSubjects();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save subject');
    }
  };

  const editSubject = (sub) => {
    setSubjectForm(sub);
    setEditingId(sub._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSubject = async (id) => {
    if (window.confirm('Delete this subject? This action cannot be undone.')) {
      try {
        await api.delete(`/subjects/${id}`);
        triggerAlert('success', 'Subject deleted');
        fetchSubjects();
      } catch (err) {
        triggerAlert('error', 'Failed to delete subject');
      }
    }
  };

  // ================= TAB 2: UPLOAD SUBJECTS =================
  const [fileData, setFileData] = useState([]);
  const [uploadStrategy, setUploadStrategy] = useState('skip'); // skip or overwrite

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setFileData(data);
    };
    reader.readAsBinaryString(file);
  };

  const submitBulkUpload = async () => {
    if (fileData.length === 0) return triggerAlert('error', 'No data to upload.');
    try {
      const res = await api.post('/subjects/bulk', { subjects: fileData, strategy: uploadStrategy });
      triggerAlert('success', `Imported: ${res.data.imported}, Skipped: ${res.data.skipped}`);
      setFileData([]);
      document.getElementById('file-upload').value = "";
    } catch (err) {
      triggerAlert('error', 'Failed to perform bulk upload.');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([initialSubjectForm]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subjects");
    XLSX.writeFile(wb, "Subject_Upload_Template.xlsx");
  };

  // ================= TAB 3: SUBJECT ALLOTMENT =================
  const [allotFilters, setAllotFilters] = useState({ academicYear: '', department: '', course: '', semester: '', division: '' });
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedFaculties, setSelectedFaculties] = useState([]);

  useEffect(() => {
    if (activeTab === 'allotment') {
      fetchFaculties();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'allotment' && allotFilters.academicYear && allotFilters.department && allotFilters.course && allotFilters.semester) {
      fetchFilteredSubjects();
    }
  }, [allotFilters, activeTab]);

  const fetchFaculties = async () => {
    try {
      const res = await api.get('/faculty'); // Assuming faculty endpoint exists
      setFaculties(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchFilteredSubjects = async () => {
    try {
      const query = new URLSearchParams(allotFilters).toString();
      const res = await api.get(`/subjects?${query}`);
      setAvailableSubjects(res.data);
      setSelectedSubjects([]);
    } catch (err) { console.error(err); }
  };

  const submitAllotment = async () => {
    if (selectedSubjects.length === 0 || selectedFaculties.length === 0) {
      return triggerAlert('error', 'Select at least one subject and one faculty.');
    }
    if (!allotFilters.division) return triggerAlert('error', 'Division is required for allotment.');
    try {
      await api.post('/subjects/allotment', {
        subjectIds: selectedSubjects,
        facultyIds: selectedFaculties,
        ...allotFilters
      });
      triggerAlert('success', 'Subject allotment saved successfully!');
      setSelectedSubjects([]);
      setSelectedFaculties([]);
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save allotment');
    }
  };

  const toggleSelection = (id, list, setList) => {
    if (list.includes(id)) setList(list.filter(item => item !== id));
    else setList([...list, id]);
  };

  return (
    <div style={pageContainer}>
      <h2 style={{ fontSize: '20px', color: '#1a202c', marginBottom: '20px' }}>Subject Management</h2>

      {alert.show && (
        <div id="alert-banner" style={{ padding: '12px 20px', marginBottom: '20px', borderRadius: '6px', color: '#fff', backgroundColor: alert.type === 'success' ? '#38a169' : '#e53e3e', fontSize: '14px', fontWeight: '600' }}>
          {alert.message}
        </div>
      )}

      <div style={tabContainer}>
        <button style={getTabStyle('manage')} onClick={() => setActiveTab('manage')}>Add & Manage Subjects</button>
        <button style={getTabStyle('upload')} onClick={() => setActiveTab('upload')}>Upload Bulk Subjects</button>
        <button style={getTabStyle('allotment')} onClick={() => setActiveTab('allotment')}>Subject Allotment</button>
      </div>

      {activeTab === 'manage' && (
        <>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#2F5597' }}>{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
            <form onSubmit={handleSubjectSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={fieldBox}><label style={labelStyle}>Subject Code</label><input type="text" name="subjectCode" value={subjectForm.subjectCode} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>Subject Name *</label><input type="text" name="name" value={subjectForm.name} onChange={handleSubjectChange} style={inputStyle} required /></div>
                <div style={fieldBox}><label style={labelStyle}>Short Name</label><input type="text" name="subjectShortName" value={subjectForm.subjectShortName} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>Type</label>
                  <select name="subjectType" value={subjectForm.subjectType} onChange={handleSubjectChange} style={inputStyle}>
                    <option value="Theory">Theory</option><option value="Practical">Practical</option><option value="Project">Project</option><option value="Lab">Lab</option><option value="Elective">Elective</option>
                  </select>
                </div>
                <div style={fieldBox}><label style={labelStyle}>Department *</label>
                  <select name="department" value={subjectForm.department} onChange={handleSubjectChange} style={inputStyle} required>
                    <option value="">Select</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={fieldBox}><label style={labelStyle}>Course *</label>
                  <select name="course" value={subjectForm.course} onChange={handleSubjectChange} style={inputStyle} required>
                    <option value="">Select</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={fieldBox}><label style={labelStyle}>Semester *</label>
                  <select name="semester" value={subjectForm.semester} onChange={handleSubjectChange} style={inputStyle} required>
                    <option value="">Select</option>{semesters.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={fieldBox}><label style={labelStyle}>Academic Year *</label>
                  <select name="academicYear" value={subjectForm.academicYear} onChange={handleSubjectChange} style={inputStyle} required>
                    <option value="">Select</option>{academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={fieldBox}><label style={labelStyle}>Credits</label><input type="number" name="credits" value={subjectForm.credits} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>Internal Marks</label><input type="number" name="internalMarks" value={subjectForm.internalMarks} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>External Marks</label><input type="number" name="externalMarks" value={subjectForm.externalMarks} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>Passing Marks</label><input type="number" name="passingMarks" value={subjectForm.passingMarks} onChange={handleSubjectChange} style={inputStyle} /></div>
                <div style={fieldBox}><label style={labelStyle}>Status</label>
                  <select name="status" value={subjectForm.status} onChange={handleSubjectChange} style={inputStyle}>
                    <option value="Active">Active</option><option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={btnStyle('#2F5597', '#fff')}>{editingId ? 'Update Subject' : 'Save Subject'}</button>
                {editingId && <button type="button" onClick={() => { setEditingId(null); setSubjectForm(initialSubjectForm); }} style={btnStyle('#e2e8f0', '#4a5568')}>Cancel Edit</button>}
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#2F5597' }}>Subject List</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f6fb', borderBottom: '2px solid #dde3f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Code</th>
                    <th style={{ padding: '12px' }}>Name</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Department</th>
                    <th style={{ padding: '12px' }}>Sem/Year</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{s.subjectCode || '-'}</td>
                      <td style={{ padding: '10px', fontWeight: '500' }}>{s.name}</td>
                      <td style={{ padding: '10px' }}>{s.subjectType}</td>
                      <td style={{ padding: '10px' }}>{s.department}</td>
                      <td style={{ padding: '10px' }}>{s.semester} / {s.academicYear}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: s.status === 'Active' ? '#c6f6d5' : '#fed7d7', color: s.status === 'Active' ? '#22543d' : '#822727' }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => editSubject(s)} style={{ padding: '4px 8px', background: '#eef4ff', color: '#2F5597', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Edit</button>
                        <button onClick={() => deleteSubject(s._id)} style={{ padding: '4px 8px', background: '#fff5f5', color: '#e53e3e', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {subjects.length === 0 && <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#718096' }}>No subjects found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#2F5597' }}>Bulk Upload Subjects</h3>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
            <input type="file" id="file-upload" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ padding: '10px', border: '1px dashed #ccc', borderRadius: '6px' }} />
            <button onClick={downloadTemplate} style={btnStyle('#e2e8f0', '#2d3748')}>Download Template</button>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500' }}>If Duplicate Found:</label>
              <select value={uploadStrategy} onChange={(e) => setUploadStrategy(e.target.value)} style={inputStyle}>
                <option value="skip">Skip Record</option>
                <option value="overwrite">Overwrite Record</option>
              </select>
            </div>
          </div>

          {fileData.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Preview Data ({fileData.length} records)</span>
                <button onClick={submitBulkUpload} style={btnStyle('#38a169', '#fff')}>Confirm & Import</button>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f4f6fb' }}>
                    <tr>
                      {Object.keys(fileData[0]).map((key) => <th key={key} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{key}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => <td key={j} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{val}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'allotment' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#2F5597' }}>Subject Allotment (Faculty to Subject Mapping)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={fieldBox}><label style={labelStyle}>Academic Year</label>
              <select value={allotFilters.academicYear} onChange={(e) => setAllotFilters({...allotFilters, academicYear: e.target.value})} style={inputStyle}>
                <option value="">Select</option>{academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={fieldBox}><label style={labelStyle}>Department</label>
              <select value={allotFilters.department} onChange={(e) => setAllotFilters({...allotFilters, department: e.target.value})} style={inputStyle}>
                <option value="">Select</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={fieldBox}><label style={labelStyle}>Course</label>
              <select value={allotFilters.course} onChange={(e) => setAllotFilters({...allotFilters, course: e.target.value})} style={inputStyle}>
                <option value="">Select</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={fieldBox}><label style={labelStyle}>Semester</label>
              <select value={allotFilters.semester} onChange={(e) => setAllotFilters({...allotFilters, semester: e.target.value})} style={inputStyle}>
                <option value="">Select</option>{semesters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fieldBox}><label style={labelStyle}>Division *</label>
              <input type="text" placeholder="e.g. A" value={allotFilters.division} onChange={(e) => setAllotFilters({...allotFilters, division: e.target.value})} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', minHeight: '300px' }}>
            {/* Subjects List */}
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>1. Select Subjects</h4>
              {allotFilters.academicYear && allotFilters.semester ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {availableSubjects.map(sub => (
                    <label key={sub._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '6px', backgroundColor: selectedSubjects.includes(sub._id) ? '#eef4ff' : 'transparent', borderRadius: '4px' }}>
                      <input type="checkbox" checked={selectedSubjects.includes(sub._id)} onChange={() => toggleSelection(sub._id, selectedSubjects, setSelectedSubjects)} />
                      {sub.subjectCode} - {sub.name} ({sub.subjectType})
                    </label>
                  ))}
                  {availableSubjects.length === 0 && <span style={{ fontSize: '12px', color: '#a0aec0' }}>No subjects found for this selection.</span>}
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: '#a0aec0' }}>Please select filters above to view subjects.</span>
              )}
            </div>

            {/* Faculty List */}
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>2. Select Faculty</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {faculties.map(fac => (
                  <label key={fac._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '6px', backgroundColor: selectedFaculties.includes(fac._id) ? '#eef4ff' : 'transparent', borderRadius: '4px' }}>
                    <input type="checkbox" checked={selectedFaculties.includes(fac._id)} onChange={() => toggleSelection(fac._id, selectedFaculties, setSelectedFaculties)} />
                    {fac.name} ({fac.department})
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
            {(!allotFilters.division || selectedSubjects.length === 0 || selectedFaculties.length === 0) && (
              <span style={{ fontSize: '12px', color: '#e53e3e', fontWeight: '500' }}>
                * Division, at least 1 subject, and at least 1 faculty are required.
              </span>
            )}
            <button 
              onClick={() => { submitAllotment(); setTimeout(() => document.getElementById('alert-banner')?.scrollIntoView({ behavior: 'smooth' }), 100); }} 
              style={{ ...btnStyle('#2F5597', '#fff'), opacity: (!allotFilters.division || selectedSubjects.length === 0 || selectedFaculties.length === 0) ? 0.5 : 1 }} 
              disabled={!allotFilters.division || selectedSubjects.length === 0 || selectedFaculties.length === 0}
            >
              Assign Faculties to Subjects
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
