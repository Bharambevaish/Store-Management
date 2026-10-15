import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function GenerateHallTicket() {
  const [searchTerm, setSearchTerm] = useState('');
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [institute, setInstitute] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchInstitute();
  }, []);

  const fetchInstitute = async () => {
    try {
      const res = await api.get('/institute');
      setInstitute(res.data);
    } catch (err) {
      console.error(err);
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
    setSubjects([]);
    try {
      const res = await api.get(`/students/${searchTerm.trim()}`);
      setStudent(res.data);
      
      // Fetch subjects for that student's course and semester
      const subRes = await api.get('/subjects');
      const filteredSubs = subRes.data.filter(s => s.course === res.data.course && s.semester === res.data.semester);
      setSubjects(filteredSubs);

      if (filteredSubs.length === 0) {
        triggerAlert('error', 'No subjects configured for this semester; generated ticket will show default listings.');
      } else {
        triggerAlert('success', 'Examination Hall Ticket generated!');
      }
    } catch (err) {
      triggerAlert('error', 'Student not found. Please enter a valid ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type} no-print`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="form-card no-print" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#2F5597', marginBottom: '12px' }}>Generate Student Hall Ticket</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1, maxWidth: 'none' }}
            placeholder="Enter Student ID (e.g. STU2026001)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="primary">Compile Ticket</button>
        </form>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px' }}>Searching registry records...</div>}

      {/* Hall Ticket Card Frame */}
      {student && (
        <div>
          <div className="btn-container no-print" style={{ marginBottom: '16px', marginTop: 0 }}>
            <button className="primary" onClick={() => window.print()}>🖨️ Print Exam Hall Ticket</button>
          </div>

          <div style={{
            border: '2px solid #3F3F3F',
            borderRadius: '8px',
            backgroundColor: '#FFF',
            padding: '30px',
            color: '#3F3F3F',
            boxShadow: 'var(--shadow)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3F3F3F', paddingBottom: '14px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: '#2F5597', fontSize: '20px' }}>
                  {institute?.name || 'Demo Institute'}
                </h2>
                <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '13px' }}>
                  End Semester Examinations Hall Ticket (Admit Card)
                </h4>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#595959' }}>
                <span>Academic Year: 2026-27</span><br/>
                <span>Exam Session: Summer-26</span>
              </div>
            </div>

            {/* Student Info Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '13px' }}>
                <p>👤 <strong>Student Name:</strong> {student.firstName} {student.lastName}</p>
                <p>📋 <strong>Roll Number:</strong> {student.rollNumber}</p>
                <p>🔑 <strong>Student ID:</strong> {student.studentId}</p>
                <p>🎓 <strong>Course Code:</strong> {student.course}</p>
                <p>🏫 <strong>Semester:</strong> Semester {student.semester}</p>
                <p>🏛️ <strong>Exam Center:</strong> Campus Block A, Hall-12</p>
              </div>

              {/* Student Photo */}
              <div style={{
                width: '90px',
                height: '90px',
                border: '1px solid #7F7F7F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--soft-gray)'
              }}>
                {student.photo ? (
                  <img src={student.photo} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '24px' }}>👤</span>
                )}
              </div>
            </div>

            {/* Exam Roster Table */}
            <h4 style={{ color: '#7030A0', marginBottom: '10px' }}>Examination Schedule & Courses</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #7F7F7F', padding: '6px', textAlign: 'center', width: '50px' }}>Sr. No</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '6px', width: '100px' }}>Course ID</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '6px' }}>Course Title</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '6px', width: '140px', textAlign: 'center' }}>Exam Date & Session</th>
                  <th style={{ border: '1px solid #7F7F7F', padding: '6px', width: '120px', textAlign: 'center' }}>Supervisor Initial</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length > 0 ? (
                  subjects.map((sub, idx) => (
                    <tr key={sub._id}>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}>{sub.subjectId}</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}><strong>{sub.name}</strong></td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center', fontSize: '12px' }}>TBA (09:30 AM)</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}></td>
                    </tr>
                  ))
                ) : (
                  // Default mock rows if no subjects configured
                  ['Mathematics-I', 'Engineering Mechanics', 'Basic Programming', 'Environmental Studies'].map((name, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}>CS{idx + 101}</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}><strong>{name}</strong></td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px', textAlign: 'center', fontSize: '12px' }}>TBA (09:30 AM)</td>
                      <td style={{ border: '1px solid #D9D9D9', padding: '8px' }}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginTop: '40px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '120px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '11px' }}>Signature of Candidate</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '120px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Controller of Examinations</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
