import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Certificates({ activeMode = 'leaving' }) {
  // activeMode: leaving, bonafide, lc_register, bonafide_register
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [generatedCert, setGeneratedCert] = useState(null);
  const [institute, setInstitute] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchCertificates();
    fetchInstitute();
  }, [activeMode]);

  const fetchCertificates = async () => {
    try {
      const typeQuery = activeMode.includes('leaving') || activeMode.includes('lc_') ? 'Leaving' : 'Bonafide';
      const res = await api.get(`/certificates?type=${typeQuery}`);
      setCertificates(res.data);
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setGeneratedCert(null);
    try {
      const typeParam = activeMode === 'leaving' ? 'Leaving' : 'Bonafide';
      const res = await api.post('/certificates/generate', { studentId, type: typeParam, reason });
      setGeneratedCert(res.data.certificate);
      triggerAlert('success', `${typeParam} Certificate Generated Successfully!`);
      setStudentId('');
      setReason('');
      fetchCertificates();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to generate certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this certificate?')) return;
    try {
      // Mock cancel
      triggerAlert('success', 'Certificate cancelled');
      fetchCertificates();
    } catch (err) {
      console.error(err);
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

      {/* GENERATION VIEW */}
      {(activeMode === 'leaving' || activeMode === 'bonafide') && (
        <div style={{ display: 'grid', gridTemplateColumns: generatedCert ? '1fr' : '1fr', gap: '24px' }}>
          
          {!generatedCert ? (
            <div className="form-card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <h2 style={{ color: '#2F5597', marginBottom: '20px' }}>
                🎓 Generate {activeMode === 'leaving' ? 'Leaving' : 'Bonafide'} Certificate
              </h2>
              <form onSubmit={handleGenerate}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label>Student ID *</label>
                  <input
                    type="text"
                    placeholder="Enter Student ID (e.g. STU2026001)"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value.toUpperCase().trim())}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Reason for Application</label>
                  <input
                    type="text"
                    placeholder="e.g. Course Completion / Higher Education"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>

                <button type="submit" className="primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Processing...' : 'Generate Certificate'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              {/* Generated Certificate Display Frame */}
              <div className="btn-container no-print" style={{ marginBottom: '16px', marginTop: 0 }}>
                <button className="secondary" onClick={() => setGeneratedCert(null)}>Generate Another</button>
                <button className="primary" onClick={() => window.print()}>🖨️ Print Certificate</button>
              </div>

              {/* Certificate Template Card */}
              <div style={{
                border: '10px double var(--pastel-blue-dark)',
                padding: '40px',
                backgroundColor: 'var(--white)',
                fontFamily: 'serif',
                textAlign: 'center',
                color: '#3F3F3F',
                maxWidth: '750px',
                margin: '0 auto',
                boxShadow: '0 0 15px rgba(0,0,0,0.05)'
              }}>
                <h1 style={{ color: '#2F5597', fontSize: '28px', margin: '0 0 4px 0' }}>
                  {institute?.name || 'Demo Institute'}
                </h1>
                <p style={{ fontSize: '12px', margin: '0 0 20px 0', fontStyle: 'italic', borderBottom: '1px solid #CCC', paddingBottom: '10px' }}>
                  {institute?.address || '123 Academic Square, Science City, IN 400001'}<br/>
                  Contact: {institute?.contact || '+91-9876543210'} | Email: {institute?.email || 'info@studentinformationsystem.edu'}
                </p>

                <h2 style={{ textTransform: 'uppercase', textDecoration: 'underline', color: '#7030A0', fontSize: '22px', margin: '24px 0' }}>
                  {generatedCert.type} Certificate
                </h2>

                <p style={{ fontSize: '11px', textAlign: 'right', margin: '0 0 30px 0' }}>
                  <strong>Serial Number:</strong> {generatedCert.serialNumber}<br/>
                  <strong>Date of Issue:</strong> {new Date(generatedCert.issueDate).toLocaleDateString()}
                </p>

                <p style={{ fontSize: '16px', lineHeight: '2.0', textAlign: 'justify', margin: '0 20px 40px 20px' }}>
                  This is to certify that Mr./Ms. <strong style={{ textDecoration: 'underline', fontSize: '18px' }}>{generatedCert.studentName}</strong>, 
                  holder of Student Identification Code <strong>{generatedCert.studentId}</strong>, was a bona fide student of this institution. 
                  During the course of study, the student maintained an exemplary record. This certificate is issued for the purpose of 
                  <strong> {generatedCert.reason || 'course progression'}</strong>.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '120px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
                    <span style={{ fontSize: '12px' }}>Registrar / Clerk</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '120px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Principal</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REGISTER VIEWS */}
      {(activeMode === 'lc_register' || activeMode === 'bonafide_register') && (
        <div className="table-container">
          <div className="table-header-bar">
            <h3 style={{ color: '#2F5597', margin: 0 }}>
              📜 {activeMode === 'lc_register' ? 'Leaving Certificate' : 'Bonafide Certificate'} Register Log
            </h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Reason</th>
                <th>Issue Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No records logged in the register.</td>
                </tr>
              ) : (
                certificates.map(c => (
                  <tr key={c._id}>
                    <td><strong>{c.serialNumber}</strong></td>
                    <td>{c.studentId}</td>
                    <td>{c.studentName}</td>
                    <td>{c.reason}</td>
                    <td>{new Date(c.issueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${c.status === 'Issued' ? 'active' : 'inactive'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" title="Cancel Certificate" onClick={() => handleCancel(c._id)}>❌</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
