import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// Dummy fallback data in case MongoDB is unavailable
const DUMMY_STUDENTS = [
  { _id: '1', studentId: 'STU001', rollNumber: 'R001', firstName: 'John', lastName: 'Smith', gender: 'Male' },
  { _id: '2', studentId: 'STU002', rollNumber: 'R002', firstName: 'Priya', lastName: 'Patel', gender: 'Female' },
  { _id: '3', studentId: 'STU003', rollNumber: 'R003', firstName: 'Rahul', lastName: 'Kumar', gender: 'Male' },
  { _id: '4', studentId: 'STU004', rollNumber: 'R004', firstName: 'Anjali', lastName: 'Sharma', gender: 'Female' },
  { _id: '5', studentId: 'STU005', rollNumber: 'R005', firstName: 'Vikram', lastName: 'Singh', gender: 'Male' },
];

const DUMMY_COURSES = [
  { _id: 'd1', courseId: 'BTECH-CS', name: 'B.Tech Computer Engineering' },
  { _id: 'd2', courseId: 'BTECH-IT', name: 'B.Tech Information Technology' },
  { _id: 'd3', courseId: 'BTECH-EXTC', name: 'B.Tech Electronics & Telecommunication' },
  { _id: 'd4', courseId: 'MTECH-CS', name: 'M.Tech Computer Engineering' },
];

export default function GenerateRollCall() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [instituteName, setInstituteName] = useState('Demo Institute');
  const printRef = useRef();

  useEffect(() => {
    fetchCourses();
    fetchInstitute();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data.length > 0 ? res.data : DUMMY_COURSES);
    } catch {
      setCourses(DUMMY_COURSES);
    }
  };

  const fetchInstitute = async () => {
    try {
      const res = await api.get('/institute');
      if (res.data?.name) setInstituteName(res.data.name);
    } catch { /* use default */ }
  };

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !selectedSemester) {
      triggerAlert('error', 'Please select both Course and Semester');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/rollcall?course=${selectedCourse}&semester=${selectedSemester}`);
      if (res.data.length === 0) {
        // Fallback to dummy data with a warning
        setStudents(DUMMY_STUDENTS);
        triggerAlert('error', 'No active students found in DB for this course/semester. Showing sample data.');
      } else {
        setStudents(res.data);
        triggerAlert('success', `Roll Call Sheet generated with ${res.data.length} students.`);
      }
    } catch {
      // On error, use dummy data gracefully
      setStudents(DUMMY_STUDENTS);
      triggerAlert('error', 'Using sample data — connect MongoDB and seed students to see real data.');
    } finally {
      setLoading(false);
    }
  };

  // ─── PRINT ───────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ─── DOWNLOAD CSV / EXCEL ─────────────────────────────────────────────────
  const downloadCSV = () => {
    const headers = ['Sr. No', 'Student ID', 'Roll No', 'Student Name', 'Gender', 'Signature/Remark'];
    const rows = students.map((st, i) => [
      i + 1,
      st.studentId,
      st.rollNumber,
      `${st.firstName} ${st.lastName}`,
      st.gender,
      ''
    ]);
    const titleRow = [`Roll Call Sheet - ${selectedCourse} | Semester ${selectedSemester} | Academic Year 2026-27`];
    const csvContent = [
      titleRow.join(','),
      '',
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rollcall_${selectedCourse}_sem${selectedSemester}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate a basic HTML table and trigger download as Excel (via data URI)
  const downloadExcel = () => {
    const tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #2F5597; color: white; padding: 8px; border: 1px solid #999; }
        td { padding: 8px; border: 1px solid #ccc; }
        .title { font-size: 16px; font-weight: bold; color: #2F5597; margin-bottom: 8px; }
      </style></head>
      <body>
        <p class="title">Roll Call Sheet — ${selectedCourse} | Semester ${selectedSemester} | ${instituteName}</p>
        <p>Academic Year: 2026-27 | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        <table>
          <thead><tr>
            <th>Sr. No</th><th>Student ID</th><th>Roll No</th><th>Student Name</th><th>Gender</th><th>Signature / Remark</th>
          </tr></thead>
          <tbody>
            ${students.map((st, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${st.studentId}</td>
                <td>${st.rollNumber}</td>
                <td><b>${st.firstName} ${st.lastName}</b></td>
                <td>${st.gender}</td>
                <td style="min-width:160px"> </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <br/><br/>
        <p>Date: ________________________</p>
        <p style="margin-top:40px">_____________________________<br/><b>Faculty Signature / Supervisor</b></p>
      </body></html>`;
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rollcall_${selectedCourse}_sem${selectedSemester}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type} no-print`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Select Box Panel */}
      <div className="form-card no-print" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#2F5597', marginBottom: '16px' }}>📋 Generate Roll Call Sheet</h3>
        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label>Course Program</label>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
              <option value="">Select Course</option>
              {courses.map(c => (
                <option key={c._id} value={c.courseId}>{c.courseId} - {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
            <label>Semester</label>
            <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              {['1','2','3','4','5','6','7','8'].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="primary" style={{ padding: '10px 24px', height: 'fit-content' }} disabled={loading}>
            {loading ? '⏳ Generating...' : '📋 Generate Sheet'}
          </button>
        </form>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>⏳ Compiling roll call register...</div>}

      {/* Printable Sheet Panel */}
      {students.length > 0 && (
        <div>
          {/* Action Buttons — no-print */}
          <div className="no-print" style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🖨️ Print Sheet
            </button>
            <button className="secondary" onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              📄 Download CSV
            </button>
            <button className="secondary" onClick={downloadExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1D6F42', color: '#fff', borderColor: '#1D6F42' }}>
              📊 Download Excel
            </button>
            <span style={{ alignSelf: 'center', fontSize: '13px', color: '#888' }}>
              {students.length} students
            </span>
          </div>

          {/* The printable sheet */}
          <div ref={printRef} style={{
            backgroundColor: 'var(--white)',
            padding: '30px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--soft-gray)',
            boxShadow: 'var(--shadow)',
            color: '#3F3F3F'
          }}>
            {/* Sheet Title */}
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #595959', paddingBottom: '12px' }}>
              <h2 style={{ margin: '0 0 4px 0', color: '#2F5597' }}>{instituteName}</h2>
              <h3 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', fontSize: '16px' }}>Official Academic Roll Call / Attendance Log</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#7F7F7F' }}>
                Course: <strong>{selectedCourse}</strong> &nbsp;|&nbsp; Semester: <strong>{selectedSemester}</strong> &nbsp;|&nbsp; Academic Year: 2026-27
                &nbsp;|&nbsp; Total Students: <strong>{students.length}</strong>
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>
                Generated on: {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Attendance Grid Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2F5597', color: '#fff' }}>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px', textAlign: 'center', width: '50px' }}>Sr.</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px', width: '110px' }}>Student ID</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px', width: '90px' }}>Roll No</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px' }}>Student Name</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px', width: '70px', textAlign: 'center' }}>Gender</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '8px', width: '170px', textAlign: 'center' }}>Signature / Remark</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, index) => (
                  <tr key={st._id} style={{ background: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}>{st.studentId}</td>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}>{st.rollNumber}</td>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}><strong>{st.firstName} {st.lastName}</strong></td>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center' }}>{st.gender ? st.gender.substring(0, 1) : ''}</td>
                    <td style={{ border: '1px solid #D9D9D9', padding: '8px', height: '36px' }}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signature Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#7F7F7F' }}>Date: ___________________________</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '200px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Faculty Signature / Supervisor</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
