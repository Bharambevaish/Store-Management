import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function DocumentVerification() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    course: '',
    semester: '',
    documentType: '',
    status: 'Pending Verification',
    studentId: ''
  });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchCourses();
    fetchDocuments();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 3000);
  };

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
      const query = new URLSearchParams();
      if (filters.course) query.append('course', filters.course);
      if (filters.semester) query.append('semester', filters.semester);
      if (filters.status) query.append('status', filters.status);
      if (filters.studentId) query.append('studentId', filters.studentId);
      if (filters.documentType) query.append('documentType', filters.documentType);

      const res = await api.get(`/documents?${query.toString()}`);
      setDocuments(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => {
    fetchDocuments();
  };

  const handleVerify = async (docId, status, remarks = '') => {
    try {
      await api.put(`/documents/${docId}/verify`, { status, remarks });
      triggerAlert('success', `Document ${status.toLowerCase()} successfully`);
      fetchDocuments();
    } catch (err) {
      triggerAlert('error', 'Failed to update document status');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert ${alert.type}`} style={{ padding: '12px', marginBottom: '20px', borderRadius: '4px', color: '#fff', backgroundColor: alert.type === 'success' ? '#38a169' : '#e53e3e' }}>
          {alert.message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#2F5597', margin: 0 }}>🛡️ Digital Document Verification Portal</h2>
      </div>

      <div className="form-card" style={{ marginBottom: '20px' }}>
        <h4 style={{ color: '#595959', margin: '0 0 16px 0' }}>Filter Documents</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Course</label>
            <select name="course" value={filters.course} onChange={handleFilterChange}>
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c._id} value={c.courseCode}>{c.courseName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Semester</label>
            <select name="semester" value={filters.semester} onChange={handleFilterChange}>
              <option value="">All Semesters</option>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="form-group">
            <label>Student ID / Roll No</label>
            <input name="studentId" value={filters.studentId} onChange={handleFilterChange} placeholder="Search ID..." />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="primary" onClick={applyFilters} style={{ width: '100%' }}>🔍 Apply Filters</button>
          </div>
        </div>
      </div>

      <div className="form-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#7F7F7F' }}>Loading documents...</div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#7F7F7F' }}>No documents found matching the filters.</div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '1000px', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Student Info</th>
                  <th>Document Name</th>
                  <th>Category</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc._id}>
                    <td>
                      <strong>{doc.studentName}</strong>
                      <div style={{ fontSize: '11px', color: '#555' }}>ID: {doc.studentId}</div>
                      <div style={{ fontSize: '11px', color: '#555' }}>Course: {doc.course || '-'}</div>
                    </td>
                    <td>{doc.documentType}</td>
                    <td>{doc.category || 'General'}</td>
                    <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${doc.verificationStatus === 'Approved' ? 'active' : doc.verificationStatus === 'Rejected' ? 'inactive' : 'pending'}`}>
                        {doc.verificationStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <a href={doc.fileContent} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ fontSize: '12px', color: '#2b6cb0', textDecoration: 'none' }}>👁️ Preview</a>
                        <a href={doc.fileContent} download={doc.fileName} className="icon-btn" style={{ color: '#2b6cb0', fontSize: '12px', textDecoration: 'none' }}>⬇️ Download</a>
                        
                        {doc.verificationStatus !== 'Approved' && (
                          <button type="button" className="icon-btn" style={{ color: '#38a169', fontSize: '12px', fontWeight: 'bold' }} onClick={() => {
                            const remarks = prompt("Any remarks for approval?");
                            if(remarks !== null) handleVerify(doc._id, 'Approved', remarks);
                          }}>✅ Approve</button>
                        )}
                        {doc.verificationStatus !== 'Rejected' && (
                          <button type="button" className="icon-btn" style={{ color: '#e53e3e', fontSize: '12px', fontWeight: 'bold' }} onClick={() => {
                            const remarks = prompt("Reason for rejection:");
                            if(remarks !== null) handleVerify(doc._id, 'Rejected', remarks);
                          }}>❌ Reject</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
