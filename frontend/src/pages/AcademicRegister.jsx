import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const ACADEMIC_YEARS = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23'];
const ATTRIBUTES = ['', 'gender', 'department', 'status', 'course'];
const ATTRIBUTE_LABELS = { '': 'Select', gender: 'Gender', department: 'Department', status: 'Status', course: 'Course' };

// Auto-compute grade from marks
const computeGrade = (marks) => {
  const m = Number(marks);
  if (m >= 90) return 'O';
  if (m >= 80) return 'A+';
  if (m >= 70) return 'A';
  if (m >= 60) return 'B+';
  if (m >= 50) return 'B';
  if (m >= 40) return 'C';
  return 'F';
};
const computeStatus = (marks) => Number(marks) >= 40 ? 'Pass' : 'Fail';
const gradeColor = (g) => {
  if (g === 'O' || g === 'A+') return '#1a7f37';
  if (g === 'A' || g === 'B+') return '#2F5597';
  if (g === 'B' || g === 'C') return '#d69e2e';
  return '#e53e3e';
};

export default function AcademicRegister() {
  // ─── Filter state (matches the screenshot UI) ─────────────────────────────
  const [tab, setTab] = useState('register'); // 'register' | 'data'
  const [filters, setFilters] = useState({
    academicYear: '',
    courseName: '',
    className: '',        // semester
    attribute: '',
    attributeValue: '',
    showInactive: false
  });

  // ─── Data state ────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false); // whether Show was clicked

  // ─── Grade entry per student ───────────────────────────────────────────────
  // grades are stored keyed by studentId
  const [gradesMap, setGradesMap] = useState({});
  const [gradeForm, setGradeForm] = useState({ subject: '', marks: '', grade: 'A', status: 'Pass', maxMarks: 100, outOf: 100 });

  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const printRef = useRef();

  useEffect(() => {
    fetchCourses();
    fetchSubjects();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data || []);
    } catch { /* ignore */ }
  };

  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data || []);
      if (res.data?.length > 0) {
        setGradeForm(prev => ({ ...prev, subject: res.data[0].name }));
      }
    } catch { /* ignore */ }
  };

  // ─── Main SHOW handler ─────────────────────────────────────────────────────
  const handleShow = async () => {
    setLoading(true);
    setShown(false);
    setSelectedStudent(null);
    try {
      let q = '';
      if (filters.courseName) q += `&course=${encodeURIComponent(filters.courseName)}`;
      if (filters.className)  q += `&semester=${filters.className}`;
      if (!filters.showInactive) q += '&status=Active';
      else q += '&status=Inactive';
      q = q ? `?${q.slice(1)}` : '';

      const res = await api.get(`/students${q}`);
      let data = res.data.students || [];

      // Client-side attribute filter
      if (filters.attribute && filters.attributeValue) {
        const attr = filters.attribute;
        const val = filters.attributeValue.toLowerCase();
        data = data.filter(s => s[attr] && String(s[attr]).toLowerCase().includes(val));
      }

      setStudents(data);
      setShown(true);
      if (data.length === 0) {
        triggerAlert('error', 'No students found matching your filters.');
      } else {
        // Fetch grades for all these students so the Data tab works
        data.forEach(s => fetchGradesForStudent(s.studentId));
      }
    } catch {
      triggerAlert('error', 'Failed to fetch students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Grade management ──────────────────────────────────────────────────────
  const getStudentGrades = (studentId) => gradesMap[studentId] || [];

  const handleAddGrade = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!gradeForm.subject || gradeForm.marks === '') {
      triggerAlert('error', 'Please fill in subject and marks.');
      return;
    }
    const auto = { ...gradeForm, marks: Number(gradeForm.marks), grade: computeGrade(gradeForm.marks), status: computeStatus(gradeForm.marks) };
    
    try {
      const payload = {
        studentId: selectedStudent.studentId,
        courseId: selectedStudent.course,
        semester: selectedStudent.semester,
        ...auto
      };
      await api.post('/grades', payload);
      triggerAlert('success', `Grade logged: ${auto.subject} — ${auto.marks} marks (${auto.grade})`);
      setGradeForm(prev => ({ ...prev, marks: '' }));
      fetchGradesForStudent(selectedStudent.studentId);
    } catch (err) {
      triggerAlert('error', 'Failed to save grade');
    }
  };

  const handleDeleteGrade = async (studentId, gradeId) => {
    try {
      await api.delete(`/grades/${gradeId}`);
      triggerAlert('success', 'Grade deleted');
      fetchGradesForStudent(studentId);
    } catch (err) {
      triggerAlert('error', 'Failed to delete grade');
    }
  };

  const fetchGradesForStudent = async (studentId) => {
    try {
      const res = await api.get(`/grades/${studentId}`);
      setGradesMap(prev => ({ ...prev, [studentId]: res.data }));
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Download CSV for selected student ────────────────────────────────────
  const downloadCSV = () => {
    if (!selectedStudent) return;
    const grades = getStudentGrades(selectedStudent.studentId);
    const rows = [
      ['Academic Register', `${selectedStudent.firstName} ${selectedStudent.lastName}`, '', '', ''],
      ['Student ID', selectedStudent.studentId, 'Roll No', selectedStudent.rollNumber, ''],
      ['Course', selectedStudent.course, 'Semester', selectedStudent.semester, ''],
      ['Academic Year', filters.academicYear || '2026-27', '', '', ''],
      [],
      ['Subject', 'Max Marks', 'Marks Obtained', 'Grade', 'Status'],
      ...grades.map(g => [g.subject, g.outOf || 100, g.marks, g.grade, g.status])
    ];
    const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic_register_${selectedStudent.studentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Summary stats across all shown students ───────────────────────────────
  const allGrades = students.flatMap(s => getStudentGrades(s.studentId));
  const passed = allGrades.filter(g => g.status === 'Pass').length;
  const failed = allGrades.filter(g => g.status === 'Fail').length;
  const avgMarks = allGrades.length > 0 ? (allGrades.reduce((a, g) => a + Number(g.marks), 0) / allGrades.length).toFixed(1) : 0;

  const semesterOptions = ['1','2','3','4','5','6','7','8'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Tab selector */}
        <div style={{ display: 'flex', borderBottom: '2px solid #E8F0FE', padding: '12px 20px 0', gap: '24px', background: '#f7f9ff' }}>
          {[['register', '📒 Academic Register'], ['data', '📊 Academic Data']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600',
                padding: '8px 4px', fontSize: '13px',
                borderBottom: tab === key ? '3px solid #2F5597' : '3px solid transparent',
                color: tab === key ? '#2F5597' : '#888',
                transition: 'all 0.2s'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f7f9ff', borderBottom: '1px solid #E8F0FE' }}>
          <div className="form-group" style={{ minWidth: '120px' }}>
            <label>Academic Year</label>
            <select value={filters.academicYear} onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))}>
              <option value="">Select</option>
              {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '200px', flex: 2 }}>
            <label>Course Name</label>
            <select value={filters.courseName} onChange={e => setFilters(f => ({ ...f, courseName: e.target.value }))}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '120px' }}>
            <label>Class / Semester</label>
            <select value={filters.className} onChange={e => setFilters(f => ({ ...f, className: e.target.value }))}>
              <option value="">All Semesters</option>
              {semesterOptions.map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '120px' }}>
            <label>Attribute</label>
            <select value={filters.attribute} onChange={e => setFilters(f => ({ ...f, attribute: e.target.value, attributeValue: '' }))}>
              {Object.entries(ATTRIBUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {filters.attribute && (
            <div className="form-group" style={{ minWidth: '120px' }}>
              <label>Value</label>
              <input value={filters.attributeValue} onChange={e => setFilters(f => ({ ...f, attributeValue: e.target.value }))} placeholder="e.g. Male" />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
            <input type="checkbox" id="showInactive" checked={filters.showInactive} onChange={e => setFilters(f => ({ ...f, showInactive: e.target.checked }))} />
            <label htmlFor="showInactive" style={{ cursor: 'pointer', fontSize: '13px', margin: 0 }}>Show Inactive</label>
          </div>

          <button className="primary" onClick={handleShow} disabled={loading} style={{ padding: '10px 24px' }}>
            {loading ? '⏳ Loading...' : '🔍 Show'}
          </button>
        </div>
      </div>

      {/* ── TAB: ACADEMIC REGISTER ── */}
      {tab === 'register' && (
        shown ? (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Student List Sidebar */}
            <div className="table-container" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="table-header-bar">
                <h4 style={{ margin: 0, fontSize: '13px' }}>Students ({students.length})</h4>
              </div>
              <div style={{ padding: '8px' }}>
                {students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>No students found</div>
                ) : students.map(s => (
                  <div
                    key={s._id}
                    onClick={() => { setSelectedStudent(s); setGradeForm(prev => ({ ...prev, subject: subjects[0]?.name || '' })); fetchGradesForStudent(s.studentId); }}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '6px',
                      backgroundColor: selectedStudent?.studentId === s.studentId ? '#dbeafe' : '#fafafa',
                      border: selectedStudent?.studentId === s.studentId ? '1.5px solid #2F5597' : '1px solid #eee',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{s.firstName} {s.lastName}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      ID: {s.studentId} | Roll: {s.rollNumber}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Sem {s.semester} • {s.department?.split(' ')[0]}</div>
                    {getStudentGrades(s.studentId).length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', background: '#2F5597', color: '#fff', borderRadius: '10px', padding: '1px 7px' }}>
                          {getStudentGrades(s.studentId).length} grades
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel */}
            <div>
              {selectedStudent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Student Header Card */}
                  <div className="form-card" style={{ background: 'linear-gradient(135deg, #2F5597 0%, #4a7fcb 100%)', color: '#fff', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </h3>
                        <div style={{ fontSize: '13px', opacity: 0.85 }}>
                          ID: {selectedStudent.studentId} &nbsp;|&nbsp; Roll: {selectedStudent.rollNumber} &nbsp;|&nbsp; Semester {selectedStudent.semester}
                        </div>
                        <div style={{ fontSize: '13px', opacity: 0.85 }}>
                          {selectedStudent.course} &nbsp;•&nbsp; {selectedStudent.department}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
                        <button onClick={() => window.print()} className="secondary" style={{ fontSize: '12px', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: '#fff' }}>
                          🖨️ Print
                        </button>
                        <button onClick={downloadCSV} className="secondary" style={{ fontSize: '12px', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: '#fff' }}>
                          📄 Export CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Grades Table */}
                  <div className="table-container" ref={printRef}>
                    <div className="table-header-bar">
                      <h4 style={{ margin: 0 }}>
                        📋 Academic Transcript — {filters.academicYear || '2026-27'}
                      </h4>
                      {getStudentGrades(selectedStudent.studentId).length > 0 && (
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                          <span style={{ color: '#1a7f37', fontWeight: '600' }}>
                            ✅ Pass: {getStudentGrades(selectedStudent.studentId).filter(g => g.status === 'Pass').length}
                          </span>
                          <span style={{ color: '#e53e3e', fontWeight: '600' }}>
                            ❌ Fail: {getStudentGrades(selectedStudent.studentId).filter(g => g.status === 'Fail').length}
                          </span>
                          <span style={{ color: '#2F5597', fontWeight: '600' }}>
                            Avg: {getStudentGrades(selectedStudent.studentId).length > 0
                              ? (getStudentGrades(selectedStudent.studentId).reduce((a, g) => a + Number(g.marks), 0) / getStudentGrades(selectedStudent.studentId).length).toFixed(1)
                              : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                    {getStudentGrades(selectedStudent.studentId).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        No grades logged yet. Add grades using the form below.
                      </div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Subject Name</th>
                            <th>Max Marks</th>
                            <th>Marks Obtained</th>
                            <th>Percentage</th>
                            <th>Grade</th>
                            <th>Status</th>
                            <th className="no-print">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getStudentGrades(selectedStudent.studentId).map((g, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td><strong>{g.subject}</strong></td>
                              <td>{g.outOf || 100}</td>
                              <td><strong>{g.marks}</strong></td>
                              <td>{((Number(g.marks) / (g.outOf || 100)) * 100).toFixed(1)}%</td>
                              <td>
                                <span style={{ fontWeight: '800', color: gradeColor(g.grade), fontSize: '14px' }}>{g.grade}</span>
                              </td>
                              <td>
                                <span className={`badge ${g.status === 'Pass' ? 'active' : 'inactive'}`}>{g.status}</span>
                              </td>
                              <td className="no-print">
                                <button
                                  onClick={() => handleDeleteGrade(selectedStudent.studentId, g._id)}
                                  style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '16px' }}
                                >🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f0f4ff', fontWeight: '700' }}>
                            <td colSpan={3} style={{ padding: '10px 12px' }}>TOTALS / AVERAGE</td>
                            <td>{getStudentGrades(selectedStudent.studentId).reduce((a, g) => a + Number(g.marks), 0)}</td>
                            <td>
                              {((getStudentGrades(selectedStudent.studentId).reduce((a, g) => a + Number(g.marks), 0) /
                                (getStudentGrades(selectedStudent.studentId).length * 100)) * 100).toFixed(1)}%
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {/* Grade Add Form */}
                  <div className="form-card no-print">
                    <h4 style={{ color: '#7030A0', marginBottom: '14px', marginTop: 0 }}>➕ Log New Grade Entry</h4>
                    <form onSubmit={handleAddGrade} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
                        <label>Subject</label>
                        <select value={gradeForm.subject} onChange={e => setGradeForm(f => ({ ...f, subject: e.target.value }))}>
                          {subjects.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                          <option value="__custom__">Other (custom)</option>
                        </select>
                        {gradeForm.subject === '__custom__' && (
                          <select
                            value={gradeForm.subject}
                            onChange={e => setGradeForm(f => ({ ...f, subject: e.target.value }))}
                          >
                            <option value="">Select Subject</option>
                            {['Mathematics-I', 'Physics', 'Chemistry', 'Engineering Drawing', 'Data Structures', 'Database Management Systems', 'Software Engineering', 'Machine Learning', 'Computer Networks', 'Operating Systems'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="form-group" style={{ minWidth: '90px' }}>
                        <label>Out Of</label>
                        <input
                          type="number" step="0.5" min="1" max="200"
                          value={gradeForm.outOf}
                          onChange={e => setGradeForm(f => ({ ...f, outOf: e.target.value }))}
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: '90px' }}>
                        <label>Marks Obtained</label>
                        <input
                          type="number" step="0.5" min="0" max={gradeForm.outOf || 100} placeholder="e.g. 78"
                          value={gradeForm.marks}
                          onChange={e => {
                            const m = e.target.value;
                            setGradeForm(f => ({
                              ...f, marks: m,
                              grade: m ? computeGrade((Number(m) / (f.outOf || 100)) * 100) : f.grade,
                              status: m ? computeStatus((Number(m) / (f.outOf || 100)) * 100) : f.status
                            }));
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: '70px' }}>
                        <label>Grade</label>
                        <input value={gradeForm.marks ? computeGrade((Number(gradeForm.marks) / (gradeForm.outOf || 100)) * 100) : '—'} readOnly style={{ background: '#f0f4ff', fontWeight: '700', color: '#2F5597' }} />
                      </div>
                      <div className="form-group" style={{ minWidth: '80px' }}>
                        <label>Status</label>
                        <input value={gradeForm.marks ? computeStatus((Number(gradeForm.marks) / (gradeForm.outOf || 100)) * 100) : '—'} readOnly
                          style={{ background: gradeForm.marks && computeStatus((Number(gradeForm.marks) / (gradeForm.outOf || 100)) * 100) === 'Pass' ? '#f0fff4' : '#fff5f5', fontWeight: '600' }}
                        />
                      </div>
                      <button type="submit" className="primary" style={{ padding: '10px 18px' }}>Log Grade</button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="form-card" style={{ textAlign: 'center', padding: '60px 24px', color: '#888' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👈</div>
                  <p style={{ fontSize: '15px' }}>Select a student from the list on the left to view and manage their academic register.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="form-card" style={{ textAlign: 'center', padding: '60px 24px', color: '#888' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
            <p style={{ fontSize: '15px' }}>Select your filters above and click <strong>Show</strong> to load the academic register.</p>
          </div>
        )
      )}

      {/* ── TAB: ACADEMIC DATA ── */}
      {tab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Stats */}
          {shown && students.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'Total Students', value: students.length, color: '#2F5597', icon: '👨‍🎓' },
                  { label: 'Grades Logged', value: allGrades.length, color: '#7030A0', icon: '📝' },
                  { label: 'Pass Entries', value: passed, color: '#1a7f37', icon: '✅' },
                  { label: 'Fail Entries', value: failed, color: '#e53e3e', icon: '❌' },
                  { label: 'Average Marks', value: avgMarks, color: '#d69e2e', icon: '📊' },
                ].map(stat => (
                  <div key={stat.label} className="form-card" style={{ textAlign: 'center', padding: '20px', borderTop: `4px solid ${stat.color}` }}>
                    <div style={{ fontSize: '28px' }}>{stat.icon}</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: stat.color, marginTop: '6px' }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Student-wise summary table */}
              <div className="table-container">
                <div className="table-header-bar">
                  <h4 style={{ margin: 0 }}>📊 Student-wise Academic Summary</h4>
                  <span style={{ fontSize: '12px', color: '#888' }}>{filters.academicYear || '2026-27'} | {filters.courseName || 'All Courses'}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Sem</th>
                      <th>Subjects</th>
                      <th>Avg Marks</th>
                      <th>Pass</th>
                      <th>Fail</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const g = getStudentGrades(s.studentId);
                      const avg = g.length > 0 ? (g.reduce((a, gr) => a + Number(gr.marks), 0) / g.length).toFixed(1) : '—';
                      const pass = g.filter(gr => gr.status === 'Pass').length;
                      const fail = g.filter(gr => gr.status === 'Fail').length;
                      const result = g.length > 0 ? (fail === 0 ? 'PASS' : 'FAIL') : '—';
                      return (
                        <tr key={s._id}>
                          <td>{i + 1}</td>
                          <td>{s.studentId}</td>
                          <td><strong>{s.firstName} {s.lastName}</strong></td>
                          <td style={{ fontSize: '12px' }}>{s.course?.split(' ').slice(0, 3).join(' ')}</td>
                          <td>{s.semester}</td>
                          <td>{g.length}</td>
                          <td>{avg}</td>
                          <td><span style={{ color: '#1a7f37', fontWeight: '600' }}>{pass}</span></td>
                          <td><span style={{ color: '#e53e3e', fontWeight: '600' }}>{fail}</span></td>
                          <td>
                            {result !== '—' ? (
                              <span className={`badge ${result === 'PASS' ? 'active' : 'inactive'}`}>{result}</span>
                            ) : <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!shown && (
            <div className="form-card" style={{ textAlign: 'center', padding: '60px 24px', color: '#888' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <p>Apply filters and click <strong>Show</strong> to view academic data summary.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
