import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function DocumentsInOut() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', documentName: '', direction: 'In', status: 'Pending', remarks: '' });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [remarksUpdate, setRemarksUpdate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/docinout');
      setLogs(res.data);
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
    if (!formData.studentId.trim() || !formData.documentName.trim()) {
      triggerAlert('error', 'Student ID and Document Name are required');
      return;
    }

    try {
      await api.post('/docinout', formData);
      triggerAlert('success', 'Document tracking log created successfully');
      setFormData({ studentId: '', documentName: '', direction: 'In', status: 'Pending', remarks: '' });
      fetchLogs();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to submit document log');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/docinout/${id}`, { status, remarks: remarksUpdate });
      triggerAlert('success', `Movement log marked as ${status}`);
      setRemarksUpdate('');
      fetchLogs();
    } catch (err) {
      triggerAlert('error', 'Failed to update movement log entry');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`} style={{ gridColumn: '1 / -1' }}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Log Form */}
      <div className="form-card">
        <h3 style={{ color: '#2F5597', marginBottom: '16px' }}>Log Document In-Outward</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>Student ID *</label>
            <input
              type="text"
              placeholder="e.g. STU2026001"
              value={formData.studentId}
              onChange={e => setFormData({ ...formData, studentId: e.target.value.toUpperCase().trim() })}
              required
            />
          </div>

          <div className="form-group">
            <label>Document Title *</label>
            <input
              type="text"
              placeholder="e.g. Original 12th Leaving Certificate"
              value={formData.documentName}
              onChange={e => setFormData({ ...formData, documentName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Movement Direction *</label>
            <select value={formData.direction} onChange={e => setFormData({ ...formData, direction: e.target.value })}>
              <option value="In">Inward (Student submits original to College)</option>
              <option value="Out">Outward (College issues original to Student)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Initial Status *</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option value="Pending">Pending Review / Issue</option>
              <option value="Returned">Returned back to Student</option>
              <option value="Issued">Issued to Student (Official)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Remarks / Notes</label>
            <input
              type="text"
              placeholder="Received by clerk..."
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>

          <button type="submit" className="primary" style={{ width: '100%' }}>
            Log Movement
          </button>
        </form>
      </div>

      {/* In-Outward Register */}
      <div className="table-container">
        <div className="table-header-bar">
          <h4 style={{ margin: 0 }}>Inward / Outward Physical Registers</h4>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading register list...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Document Name</th>
                <th>Movement</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>No movements logged.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <strong>{log.studentName}</strong>
                      <div style={{ fontSize: '10px', color: '#7F7F7F' }}>ID: {log.studentId}</div>
                    </td>
                    <td>
                      {log.documentName}
                      {log.remarks && (
                        <div style={{ fontSize: '10px', color: '#7F7F7F', marginTop: '2px' }}>
                          Note: {log.remarks}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${log.direction === 'In' ? 'active' : 'pending'}`}>
                        {log.direction === 'In' ? '📥 INWARD' : '📤 OUTWARD'}
                      </span>
                      <div style={{ fontSize: '10px', color: '#7F7F7F', marginTop: '2px' }}>
                        {new Date(log.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${log.status === 'Issued' ? 'active' : log.status === 'Returned' ? 'active' : 'pending'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>
                      {log.status === 'Pending' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <input
                            type="text"
                            style={{ padding: '4px 6px', fontSize: '10px', width: '110px' }}
                            placeholder="Add remark notes..."
                            value={remarksUpdate}
                            onChange={e => setRemarksUpdate(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="icon-btn"
                              style={{ padding: '4px 6px', fontSize: '10px', color: '#385723', backgroundColor: 'var(--pastel-green)' }}
                              onClick={() => handleUpdateStatus(log._id, log.direction === 'In' ? 'Returned' : 'Issued')}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#7F7F7F' }}>Resolved</span>
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
  );
}
