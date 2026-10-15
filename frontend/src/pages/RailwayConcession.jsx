import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function RailwayConcession() {
  const [searchTerm, setSearchTerm] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [institute, setInstitute] = useState(null);
  
  // Concession specific details
  const [fromStation, setFromStation] = useState('Dadar');
  const [toStation, setToStation] = useState('Thane');
  const [travelClass, setTravelClass] = useState('Second');
  const [duration, setDuration] = useState('Monthly');
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
    try {
      const res = await api.get(`/students/${searchTerm.trim()}`);
      setStudent(res.data);
      triggerAlert('success', 'Student details loaded. Print concession slip below.');
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

      {/* Search Student Card */}
      <div className="form-card no-print" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#2F5597', marginBottom: '12px' }}>Generate Railway Concession Pass</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1, maxWidth: 'none' }}
            placeholder="Enter Student ID (e.g. STU2026001)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="primary">Load Student</button>
        </form>

        {student && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div className="form-group">
              <label>From Station</label>
              <input type="text" value={fromStation} onChange={e => setFromStation(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To Station</label>
              <input type="text" value={toStation} onChange={e => setToStation(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Class Pass</label>
              <select value={travelClass} onChange={e => setTravelClass(e.target.value)}>
                <option value="First">First Class</option>
                <option value="Second">Second Class</option>
              </select>
            </div>
            <div className="form-group">
              <label>Period / Duration</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                <option value="Monthly">Monthly Pass</option>
                <option value="Quarterly">Quarterly Pass</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px' }}>Searching database...</div>}

      {/* Printable slip */}
      {student && (
        <div>
          <div className="btn-container no-print" style={{ marginBottom: '16px', marginTop: 0 }}>
            <button className="primary" onClick={() => window.print()}>🖨️ Print Concession Slip</button>
          </div>

          <div style={{
            border: '2px dashed #000',
            backgroundColor: '#FFF',
            padding: '30px',
            color: '#3f3f3f',
            fontFamily: 'sans-serif'
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 4px 0', color: '#2F5597' }}>{institute?.name || 'Demo Institute'}</h2>
              <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '13px' }}>Railway Concession Certificate / Ticket Authority</h4>
              <p style={{ fontSize: '11px', color: '#7f7f7f', margin: '4px 0 0 0' }}>Authority code: ER/RC/2026/890 | Date: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Content Details */}
            <div style={{ fontSize: '14px', lineHeight: '1.8', marginBottom: '30px' }}>
              <p>This is to certify that Mr./Ms. <strong>{student.firstName} {student.lastName}</strong> is a registered student of this institution, 
              enrolled in the <strong>{student.course}</strong> course program (Semester {student.semester}).</p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                padding: '12px',
                backgroundColor: 'var(--soft-gray)',
                borderRadius: '6px',
                margin: '16px 0',
                border: '1px solid var(--soft-gray-dark)'
              }}>
                <span>🔑 <strong>Student ID:</strong> {student.studentId}</span>
                <span>📋 <strong>Roll Call No:</strong> {student.rollNumber}</span>
                <span>🚉 <strong>Journey From:</strong> {fromStation} Station</span>
                <span>🚉 <strong>Journey To:</strong> {toStation} Station</span>
                <span>🎫 <strong>Travel Season:</strong> {duration} Ticket</span>
                <span>🏷️ <strong>Travel Class:</strong> {travelClass} Class</span>
              </div>

              <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#7f7f7f' }}>
                * This concession form is valid for 15 days from the date of issue. To be submitted at the local railway station booking office.
              </p>
            </div>

            {/* Signature Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '120px', borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '11px' }}>Signature of Student</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '120px', borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Principal Seal / Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
