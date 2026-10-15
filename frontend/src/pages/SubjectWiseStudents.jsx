import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SubjectWiseStudents() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
      if (res.data.length > 0) {
        handleSelectSubject(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = async (sub) => {
    setSelectedSubject(sub);
    setFetchingStudents(true);
    try {
      // Handle both old format (course="BTECH-CE") and new format (course="B.Tech", department="Computer Engineering")
      let queryCourse = sub.course;
      let queryDept = sub.department || '';

      // Legacy fallback mapping
      if (sub.course === 'BTECH-CE') { queryCourse = 'B.Tech'; queryDept = 'Computer Engineering'; }
      else if (sub.course === 'BTECH-IT') { queryCourse = 'B.Tech'; queryDept = 'Information Technology'; }
      else if (sub.course === 'DIP-EXTC') { queryCourse = 'Diploma'; queryDept = 'Electronics'; }

      let url = `/students?course=${encodeURIComponent(queryCourse)}&semester=${encodeURIComponent(sub.semester)}&limit=100`;
      if (queryDept) url += `&department=${encodeURIComponent(queryDept)}`;
      
      const res = await api.get(url);
      setStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingStudents(false);
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading syllabus data...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
      {/* Subjects Panel */}
      <div className="table-container" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
        <div className="table-header-bar">
          <strong style={{ color: '#2F5597' }}>Choose a Subject</strong>
        </div>
        <div style={{ padding: '8px' }}>
          {subjects.length === 0 ? (
            <p style={{ padding: '12px', color: '#7F7F7F' }}>No subjects set up.</p>
          ) : (
            subjects.map(s => (
              <div
                key={s._id}
                onClick={() => handleSelectSubject(s)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  backgroundColor: selectedSubject?.subjectId === s.subjectId ? 'var(--pastel-blue)' : '#FAFAD2',
                  border: selectedSubject?.subjectId === s.subjectId ? '1px solid var(--pastel-blue-dark)' : '1px solid var(--soft-gray)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{s.name} ({s.subjectId})</div>
                <div style={{ fontSize: '11px', color: '#595959', marginTop: '4px' }}>
                  {s.department ? `${s.department} | ` : ''}Course: {s.course} | Sem {s.semester}
                </div>
                {s.faculty && (
                  <div style={{ fontSize: '11px', color: '#7030A0', fontStyle: 'italic', marginTop: '2px' }}>
                    Instructor: {s.faculty}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Enrolled Students Panel */}
      <div>
        {selectedSubject ? (
          <div className="table-container">
            <div className="table-header-bar" style={{ display: 'block' }}>
              <h3 style={{ color: '#385723', margin: 0 }}>{selectedSubject.name} Enrolment List</h3>
              <p style={{ fontSize: '12px', color: '#7F7F7F', marginTop: '4px' }}>
                Listing students in <strong>{selectedSubject.course}</strong>, Semester <strong>{selectedSubject.semester}</strong>
              </p>
            </div>
            {fetchingStudents ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>Querying enrolled student roster...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Email</th>
                    <th>Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#7F7F7F' }}>
                        No active students registered under this Course and Semester combination.
                      </td>
                    </tr>
                  ) : (
                    students.map(st => (
                      <tr key={st._id}>
                        <td>{st.rollNumber}</td>
                        <td><strong>{st.studentId}</strong></td>
                        <td>{st.firstName} {st.lastName}</td>
                        <td>{st.gender}</td>
                        <td>{st.email}</td>
                        <td>{st.mobile}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="form-card" style={{ textAlign: 'center', padding: '60px', color: '#7F7F7F' }}>
            Select a subject from the left panel to view students.
          </div>
        )}
      </div>
    </div>
  );
}
