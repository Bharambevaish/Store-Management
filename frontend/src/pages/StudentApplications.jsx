import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StudentApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  // Submission Form state
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', type: 'Bonafide Certificate', details: '' });
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // To handle role-based remarks
  const userRole = 'admin';

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications');
      setApplications(res.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId.trim() || !formData.details.trim()) {
      triggerAlert('error', 'All fields are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/applications', formData);
      triggerAlert('success', 'Application submitted successfully');
      setFormData({ studentId: '', type: 'Bonafide Certificate', details: '' });
      fetchApplications();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    try {
      await api.delete(`/applications/${id}`);
      triggerAlert('success', 'Application deleted successfully');
      fetchApplications();
    } catch (err) {
      triggerAlert('error', 'Failed to delete application');
    }
  };

  const handleProcess = async (id, status) => {
    try {
      const payload = { status };
      if (userRole === 'admin') {
        payload.adminRemarks = remarks;
      } else {
        payload.facultyRemarks = remarks;
      }
      
      await api.put(`/applications/${id}/process`, payload);
      triggerAlert('success', `Application has been ${status}!`);
      setRemarks('');
      fetchApplications();
    } catch (err) {
      triggerAlert('error', 'Failed to process application');
    }
  };
  
  const filteredApps = applications.filter(app => {
    if (filterType && app.type !== filterType) return false;
    if (filterStatus && app.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        app.studentName?.toLowerCase().includes(q) ||
        app.studentId?.toLowerCase().includes(q) ||
        app.rollNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }}>

        {/* Create Application Form */}
        <div className="form-card">
          <h3 style={{ marginBottom: '16px', color: '#2F5597' }}>📝 Create New Application</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>Student ID</label>
              <input 
                type="text" 
                placeholder="e.g. STU20260001"
                value={formData.studentId}
                onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>Application Type</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Bonafide Certificate">Bonafide Certificate</option>
                <option value="Leaving Certificate">Leaving Certificate</option>
                <option value="Railway Concession">Railway Concession</option>
                <option value="Character Certificate">Character Certificate</option>
                <option value="NOC">NOC</option>
                <option value="General Document">General Document</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: '300px' }}>
              <label>Reason / Details</label>
              <input 
                type="text" 
                placeholder="Enter detailed reason..."
                value={formData.details}
                onChange={e => setFormData({ ...formData, details: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>

        {/* Applications Register List */}
        <div className="table-container">
          <div className="table-header-bar">
            <h4 style={{ margin: 0 }}>Request Review Logs</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Search name, ID, roll..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Types</option>
                <option value="Bonafide Certificate">Bonafide Certificate</option>
                <option value="Leaving Certificate">Leaving Certificate</option>
                <option value="Railway Concession">Railway Concession</option>
                <option value="Character Certificate">Character Certificate</option>
                <option value="NOC">NOC</option>
                <option value="General Document">General Document</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>Loading application list...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>App ID / Date</th>
                  <th>Student</th>
                  <th>Academic Info</th>
                  <th>Request Type</th>
                  <th>Reason / Details</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>No requests found.</td>
                  </tr>
                ) : (
                  filteredApps.map(app => (
                    <tr key={app._id}>
                      <td>
                        <strong>{app.applicationId || 'N/A'}</strong>
                        <div style={{ fontSize: '10px', color: '#7F7F7F' }}>
                          {new Date(app.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <strong>{app.studentName}</strong>
                        <div style={{ fontSize: '10px', color: '#7F7F7F' }}>ID/Adm: {app.admissionNumber || app.studentId}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px' }}>Course: {app.course || 'N/A'}</div>
                        <div style={{ fontSize: '11px' }}>Sem: {app.semester || 'N/A'}</div>
                        <div style={{ fontSize: '11px' }}>Roll: {app.rollNumber || 'N/A'}</div>
                      </td>
                      <td>{app.type}</td>
                      <td>
                        <span style={{ fontSize: '12px' }}>{app.details}</span>
                      </td>
                      <td>
                        <span className={`badge ${app.status === 'Approved' ? 'active' : app.status === 'Rejected' ? 'inactive' : 'pending'}`}>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        {app.remarks && <div style={{ fontSize: '10px', color: '#595959' }}><strong>Sys:</strong> {app.remarks}</div>}
                        {app.facultyRemarks && <div style={{ fontSize: '10px', color: '#2F5597' }}><strong>Faculty:</strong> {app.facultyRemarks}</div>}
                        {app.adminRemarks && <div style={{ fontSize: '10px', color: '#C00000' }}><strong>Admin:</strong> {app.adminRemarks}</div>}
                      </td>
                      <td>
                        {app.status === 'Pending' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              type="text"
                              style={{ padding: '4px 8px', fontSize: '11px', width: '120px' }}
                              placeholder="Review remark..."
                              onChange={e => setRemarks(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="icon-btn"
                                style={{ padding: '4px 8px', fontSize: '11px', color: '#385723', backgroundColor: 'var(--pastel-green)' }}
                                onClick={() => handleProcess(app._id, 'Approved')}
                              >
                                Approve
                              </button>
                                <button
                                  className="icon-btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', color: '#C00000', backgroundColor: 'var(--pastel-pink)' }}
                                  onClick={() => handleProcess(app._id, 'Rejected')}
                                >
                                  Reject
                                </button>
                                {userRole === 'faculty' && (
                                  <button
                                    className="icon-btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#2F5597', backgroundColor: 'var(--pastel-blue)' }}
                                    onClick={() => handleProcess(app._id, 'Pending')}
                                  >
                                    Fwd Admin
                                  </button>
                                )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#7F7F7F', display: 'block', marginBottom: '8px' }}>Reviewed</span>
                        )}
                        {(userRole === 'admin' || userRole === 'faculty') && (
                          <button
                            className="icon-btn"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#fff', backgroundColor: '#C00000', width: '100%', marginTop: '4px' }}
                            onClick={() => handleDelete(app._id)}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
