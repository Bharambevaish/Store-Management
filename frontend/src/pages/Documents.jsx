import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Documents({ mode = 'list' }) {
  // mode: list (review document uploads), gallery (photograph report)
  const [documents, setDocuments] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  
  const userRole = 'admin';

  useEffect(() => {
    fetchCourses();
    if (mode === 'list') {
      fetchDocuments();
    } else {
      fetchStudentsGallery();
    }
  }, [mode, selectedCourse, selectedSemester]);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedCourse) q.append('course', selectedCourse);
      if (selectedSemester) q.append('semester', selectedSemester);
      if (selectedDocType) q.append('documentType', selectedDocType);
      if (selectedStatus) q.append('status', selectedStatus);
      
      const res = await api.get(`/documents?${q.toString()}`);
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsGallery = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedCourse) q.append('course', selectedCourse);
      if (selectedSemester) q.append('semester', selectedSemester);
      q.append('limit', '100');

      const res = await api.get(`/students?${q.toString()}`);
      setStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const handleStatusUpdate = async (id, status) => {
    const remarks = window.prompt(`Enter remarks for marking as ${status} (Optional):`, '');
    if (remarks === null) return; // cancelled
    try {
      await api.put(`/documents/${id}/verify`, { status, remarks });
      triggerAlert('success', `Document status updated to ${status}`);
      fetchDocuments();
    } catch (err) {
      triggerAlert('error', 'Failed to process document');
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to completely delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      triggerAlert('success', 'Document deleted successfully.');
      fetchDocuments();
    } catch (err) {
      triggerAlert('error', 'Failed to delete document');
    }
  };

  return (
    <div>
      {alert.show && (
        <div className={`alert-banner ${alert.type} no-print`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* MODE: Student Documents Review List */}
      {mode === 'list' && (
        <div className="table-container">
          <div className="table-header-bar" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, color: '#385723' }}>Digital Student Documents Verification Portal</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Courses</option>
                {courses.map(c => <option key={c._id} value={c.courseId}>{c.courseId}</option>)}
              </select>
              <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Semesters</option>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
              <select value={selectedDocType} onChange={e => setSelectedDocType(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Doc Types</option>
                <option value="Aadhar Card">Aadhar Card</option>
                <option value="10th Marksheet">10th Marksheet</option>
                <option value="12th Marksheet">12th Marksheet</option>
                <option value="Leaving Certificate">Leaving Certificate</option>
              </select>
              <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Statuses</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Re-upload Requested">Re-upload Requested</option>
              </select>
              <button className="secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={fetchDocuments}>Filter</button>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>Loading document registers...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Student Info</th>
                  <th>Academic Info</th>
                  <th>Document Type</th>
                  <th>File / Uploaded By</th>
                  <th>Status & History</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>No uploaded documents awaiting verification.</td>
                  </tr>
                ) : (
                  documents.map(doc => (
                    <tr key={doc._id}>
                      <td>
                        <strong>{doc.studentName}</strong>
                        <div style={{ fontSize: '10px', color: '#7F7F7F' }}>ID/Adm: {doc.admissionNumber || doc.studentId}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px' }}>Course: {doc.course || 'N/A'}</div>
                        <div style={{ fontSize: '11px' }}>Sem: {doc.semester || 'N/A'}</div>
                        <div style={{ fontSize: '11px' }}>Roll: {doc.rollNumber || 'N/A'}</div>
                      </td>
                      <td>{doc.documentType}</td>
                      <td>
                        <a href={doc.fileContent || '#'} download={doc.fileName} style={{ color: '#2F5597', textDecoration: 'none', display: 'block', fontSize: '12px' }} onClick={(e) => {
                           if (!doc.fileContent) {
                             e.preventDefault();
                             window.open(doc.documentUrl, '_blank');
                           }
                        }}>
                          📄 {doc.fileName}
                        </a>
                        <div style={{ fontSize: '10px', color: '#7F7F7F', marginTop: '4px' }}>
                          By: {doc.uploadedBy || 'System'} | {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${doc.verificationStatus === 'Approved' ? 'active' : doc.verificationStatus === 'Rejected' ? 'inactive' : 'pending'}`}>
                          {doc.verificationStatus || doc.status}
                        </span>
                        {doc.verifiedBy && (
                           <div style={{ fontSize: '10px', color: '#595959', marginTop: '4px' }}>
                             Verified By: {doc.verifiedBy} <br/>
                             On: {new Date(doc.verifiedDate).toLocaleDateString()}
                           </div>
                        )}
                        {doc.remarks && (
                           <div style={{ fontSize: '10px', color: '#C00000', marginTop: '4px' }}>
                             Remarks: {doc.remarks}
                           </div>
                        )}
                      </td>
                      <td>
                        {(doc.verificationStatus === 'Pending Verification' || !doc.verificationStatus) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              className="icon-btn"
                              style={{ color: '#385723', backgroundColor: 'var(--pastel-green)', fontSize: '11px', padding: '4px 8px', textAlign: 'left' }}
                              onClick={() => handleStatusUpdate(doc._id, 'Approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="icon-btn"
                              style={{ color: '#C00000', backgroundColor: 'var(--pastel-pink)', fontSize: '11px', padding: '4px 8px', textAlign: 'left' }}
                              onClick={() => handleStatusUpdate(doc._id, 'Rejected')}
                            >
                              Reject
                            </button>
                            <button
                              className="icon-btn"
                              style={{ color: '#936C00', backgroundColor: '#FFF6D6', fontSize: '11px', padding: '4px 8px', textAlign: 'left' }}
                              onClick={() => handleStatusUpdate(doc._id, 'Re-upload Requested')}
                            >
                              Req. Re-upload
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#7F7F7F', display: 'block', marginBottom: '8px' }}>Actioned</span>
                        )}
                        <button
                          className="icon-btn"
                          style={{ color: '#fff', backgroundColor: '#C00000', fontSize: '11px', padding: '4px 8px', marginTop: '4px', width: '100%' }}
                          onClick={() => handleDeleteDocument(doc._id)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODE: Photograph Report Gallery */}
      {mode === 'gallery' && (
        <div>
          {/* Gallery Filters */}
          <div className="form-card no-print" style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#2F5597', marginBottom: '16px' }}>📸 Photograph Directory Gallery</h3>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Course Program</label>
                <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                  <option value="">All Courses</option>
                  {courses.map(c => (
                    <option key={c._id} value={c.courseId}>{c.courseId}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
                <label>Semester</label>
                <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
                  <option value="">All Semesters</option>
                  {['1', '2', '3', '4', '5', '6', '7', '8'].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <button className="primary" onClick={() => window.print()}>🖨️ Print Photo Directory</button>
            </div>
          </div>

          <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
            <h2>Demo Institute</h2>
            <h3>Official Student Photograph Gallery Register</h3>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>Fetching photograph archives...</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '20px'
            }}>
              {students.length === 0 ? (
                <p style={{ textAlign: 'center', gridColumn: '1 / -1', color: '#7F7F7F' }}>
                  No students matching the selected course/semester filters.
                </p>
              ) : (
                students.map(st => (
                  <div
                    key={st._id}
                    style={{
                      backgroundColor: 'var(--white)',
                      borderRadius: 'var(--border-radius)',
                      padding: '16px',
                      textAlign: 'center',
                      border: '1px solid var(--soft-gray)',
                      boxShadow: 'var(--shadow)'
                    }}
                  >
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      margin: '0 auto 12px auto',
                      overflow: 'hidden',
                      backgroundColor: 'var(--pastel-blue)',
                      border: '2px solid var(--pastel-blue-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {st.photo ? (
                        <img src={st.photo} alt={st.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '32px' }}>👤</span>
                      )}
                    </div>
                    <strong style={{ fontSize: '13px', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {st.firstName} {st.lastName}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#7F7F7F', display: 'block', marginTop: '2px' }}>
                      ID: {st.studentId}
                    </span>
                    <span style={{ fontSize: '11px', color: '#2F5597', fontWeight: 'bold' }}>
                      Roll: {st.rollNumber}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
