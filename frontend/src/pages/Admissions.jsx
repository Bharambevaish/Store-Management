import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Admissions({ viewType = 'forms' }) {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [selectedApp, setSelectedApp] = useState(null);

  // New Admission form state (for direct registration submission)
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [directForm, setDirectForm] = useState({
    firstName: '', lastName: '', dob: '', gender: 'Male', mobile: '', email: '',
    address: '', fatherName: '', motherName: '', parentMobile: '', course: '',
    department: '', semester: '1'
  });

  useEffect(() => {
    fetchAdmissions();
  }, []);

  const fetchAdmissions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admissions');
      setAdmissions(res.data);
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

  const handleProcess = async (id, status) => {
    try {
      const action = status === 'Approved' ? 'approve' : 'reject';
      await api.post(`/admissions/${id}/process`, { action, remarks });
      triggerAlert('success', `Admission application has been ${status}!`);
      // Update local state immediately so UI changes without waiting
      setSelectedApp(prev => ({
        ...prev,
        status: status,
        remarks: remarks || prev.remarks
      }));
      
      setAdmissions(prevList => prevList.map(adm => 
        adm._id === id ? { ...adm, status, remarks: remarks || adm.remarks } : adm
      ));
      
      setRemarks('');
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to process admission');
    }
  };

  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!directForm.firstName || !directForm.lastName || !directForm.dob || !directForm.mobile || !directForm.email || !directForm.course || !directForm.department) {
      triggerAlert('error', 'Please fill in all required admission fields.');
      return;
    }

    if (!/^[0-9]{10}$/.test(directForm.mobile) || !/^[0-9]{10}$/.test(directForm.parentMobile)) {
      triggerAlert('error', 'Mobile numbers must be exactly 10 digits.');
      return;
    }

    setSubmittingDirect(true);
    try {
      await api.post('/admissions/submit', {
        ...directForm,
        parentDetails: {
          fatherName: directForm.fatherName || 'Not Provided',
          motherName: directForm.motherName || 'Not Provided',
          parentMobile: directForm.parentMobile || '0000000000'
        }
      });
      triggerAlert('success', 'Admission Form submitted successfully! Review status under Register/Report.');
      setDirectForm({
        firstName: '', lastName: '', dob: '', gender: 'Male', mobile: '', email: '',
        address: '', fatherName: '', motherName: '', parentMobile: '', course: '',
        department: '', semester: '1'
      });
    } catch (err) {
      triggerAlert('error', 'Failed to submit admission application.');
    } finally {
      setSubmittingDirect(false);
    }
  };

  return (
    <div>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* VIEW TYPE: Form Registration */}
      {viewType === 'direct' && (
        <div className="form-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ color: '#2F5597', marginBottom: '20px', borderBottom: '2px solid var(--soft-gray)', paddingBottom: '10px' }}>
            📋 Student Admission Application Form
          </h2>
          <form onSubmit={handleDirectSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input type="text" value={directForm.firstName} onChange={e => setDirectForm({ ...directForm, firstName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input type="text" value={directForm.lastName} onChange={e => setDirectForm({ ...directForm, lastName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>DOB *</label>
                <input type="date" value={directForm.dob} onChange={e => setDirectForm({ ...directForm, dob: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select value={directForm.gender} onChange={e => setDirectForm({ ...directForm, gender: e.target.value })}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Mobile Number *</label>
                <input type="text" maxLength="10" placeholder="10 Digits" value={directForm.mobile} onChange={e => setDirectForm({ ...directForm, mobile: e.target.value.replace(/[^0-9]/g,'') })} required />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" placeholder="email@gmail.com" value={directForm.email} onChange={e => setDirectForm({ ...directForm, email: e.target.value.trim() })} required />
              </div>
              <div className="form-group">
                <label>Associated Course *</label>
                <input type="text" placeholder="e.g. BTECH-CE" value={directForm.course} onChange={e => setDirectForm({ ...directForm, course: e.target.value.toUpperCase() })} required />
              </div>
              <div className="form-group">
                <label>Department *</label>
                <input type="text" placeholder="e.g. Computer Engineering" value={directForm.department} onChange={e => setDirectForm({ ...directForm, department: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Father's Name</label>
                <input type="text" value={directForm.fatherName} onChange={e => setDirectForm({ ...directForm, fatherName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mother's Name</label>
                <input type="text" value={directForm.motherName} onChange={e => setDirectForm({ ...directForm, motherName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Parent Mobile</label>
                <input type="text" maxLength="10" placeholder="10 Digits" value={directForm.parentMobile} onChange={e => setDirectForm({ ...directForm, parentMobile: e.target.value.replace(/[^0-9]/g,'') })} />
              </div>
              <div className="form-group full-width">
                <label>Address Details *</label>
                <textarea rows="2" value={directForm.address} onChange={e => setDirectForm({ ...directForm, address: e.target.value })} required />
              </div>
            </div>
            <div className="btn-container">
              <button type="submit" className="primary" disabled={submittingDirect}>
                {submittingDirect ? 'Submitting Application...' : 'Submit Form'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW TYPE: Forms Review Log */}
      {viewType === 'forms' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedApp ? '1fr 1fr' : '1fr', gap: '24px' }}>
          <div className="table-container">
            <div className="table-header-bar">
              <h4 style={{ margin: 0, color: '#2F5597' }}>Pending Student Intake Applications</h4>
            </div>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>Loading application register...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Form No</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center' }}>No admission forms submitted.</td>
                    </tr>
                  ) : (
                    admissions.map(adm => (
                      <tr key={adm._id}>
                        <td><strong>{adm.formNumber}</strong></td>
                        <td>{adm.studentDetails.firstName} {adm.studentDetails.lastName}</td>
                        <td>{adm.studentDetails.course}</td>
                        <td>
                          <span className={`badge ${adm.status === 'Approved' ? 'active' : adm.status === 'Rejected' ? 'inactive' : 'pending'}`}>
                            {adm.status}
                          </span>
                        </td>
                        <td>
                          <button className="secondary" onClick={() => setSelectedApp(adm)}>Review</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {selectedApp && (
            <div className="form-card">
              <h3 style={{ color: '#7030A0', marginBottom: '16px' }}>Review Application: {selectedApp.formNumber}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
                <p>👤 <strong>Student Name:</strong> {selectedApp.studentDetails.firstName} {selectedApp.studentDetails.lastName}</p>
                <p>📅 <strong>DOB:</strong> {new Date(selectedApp.studentDetails.dob).toLocaleDateString()}</p>
                <p>📞 <strong>Mobile:</strong> {selectedApp.studentDetails.mobile}</p>
                <p>✉️ <strong>Email:</strong> {selectedApp.studentDetails.email}</p>
                <p>📚 <strong>Course Plan:</strong> {selectedApp.studentDetails.course} ({selectedApp.studentDetails.department})</p>
                <p>🏠 <strong>Address:</strong> {selectedApp.studentDetails.address}</p>
              </div>

              {selectedApp.status === 'Pending' ? (
                <div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Review Notes / Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Approve or provide reject reason..." />
                  </div>
                  <div className="btn-container">
                    <button className="secondary" style={{ borderColor: 'red', color: 'red' }} onClick={() => handleProcess(selectedApp._id, 'Rejected')}>Reject</button>
                    <button className="primary" onClick={() => handleProcess(selectedApp._id, 'Approved')}>Approve & Register</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px', backgroundColor: 'var(--soft-gray)', borderRadius: '6px' }}>
                  <strong>Status:</strong> {selectedApp.status}<br/>
                  <strong>Remarks:</strong> {selectedApp.remarks || 'No notes left'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW TYPE: Admissions Report Summary */}
      {viewType === 'report' && (
        <div className="table-container">
          <div className="table-header-bar no-print">
            <h4 style={{ margin: 0 }}>Enrollment & Admissions Register Report</h4>
            <button className="primary" onClick={() => window.print()}>🖨️ Print Report</button>
          </div>
          <div className="print-only" style={{ display: 'none', textAlign: 'center', margin: '20px' }}>
            <h2>Demo Institute</h2>
            <h3>Official Admissions Status Report</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Form No</th>
                <th>Name</th>
                <th>Course</th>
                <th>Email</th>
                <th>Submit Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {admissions.map(adm => (
                <tr key={adm._id}>
                  <td><strong>{adm.formNumber}</strong></td>
                  <td>{adm.studentDetails.firstName} {adm.studentDetails.lastName}</td>
                  <td>{adm.studentDetails.course}</td>
                  <td>{adm.studentDetails.email}</td>
                  <td>{new Date(adm.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${adm.status === 'Approved' ? 'active' : adm.status === 'Rejected' ? 'inactive' : 'pending'}`}>
                      {adm.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
