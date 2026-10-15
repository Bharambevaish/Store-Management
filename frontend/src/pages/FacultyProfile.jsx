import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function FacultyProfile() {
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    email: '',
    qualification: '',
    experience: '',
    department: ''
  });

  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      const facultyDetails = res.data.user.facultyDetails;
      setUserId(res.data.user.id);
      if (facultyDetails) {
        setFaculty(facultyDetails);
        setFormData({
          name: facultyDetails.name || '',
          mobile: facultyDetails.mobile || '',
          email: facultyDetails.email || '',
          qualification: facultyDetails.qualification || '',
          experience: facultyDetails.experience || ''
        });
      } else {
        // Allow creating a new profile using User defaults
        setFormData({
          name: res.data.user.name || '',
          mobile: '',
          email: res.data.user.email || '',
          qualification: '',
          experience: '',
          department: ''
        });
        triggerAlert('error', 'Faculty details not found. Please create your profile.');
      }
    } catch (err) {
      triggerAlert('error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (faculty && faculty._id) {
        await api.put(`/faculty/${faculty._id}`, formData);
      } else {
        // Create new faculty profile
        await api.post('/faculty', { ...formData, userId, status: 'Active' });
      }
      triggerAlert('success', 'Profile updated successfully!');
      fetchProfile(); // refresh data
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading your profile...</div>;
  }

  return (
    <div className="page-wrapper">
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, color: '#2F5597', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>👨‍🏫</span> Manage Faculty Profile
          </h3>
        </div>

        <div className="card-body">
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Faculty ID (Read Only)</label>
                <input type="text" value={faculty?.facultyId || 'Not Assigned'} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </div>
              <div className="form-group">
                <label>Department {faculty ? '(Read Only)' : '*'}</label>
                <input 
                  type="text" 
                  name="department"
                  value={faculty ? faculty.department : (formData.department || '')} 
                  onChange={faculty ? undefined : handleInputChange}
                  disabled={!!faculty} 
                  required={!faculty}
                  style={faculty ? { backgroundColor: '#f5f5f5' } : {}} 
                  placeholder="e.g. Computer Engineering"
                />
              </div>
            </div>

            <h4 style={{ color: '#2F5597', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Personal Information</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Mobile Number *</label>
                <input type="text" name="mobile" value={formData.mobile} onChange={handleInputChange} required pattern="[0-9]{10}" title="Must be exactly 10 digits" />
              </div>
            </div>

            <h4 style={{ color: '#2F5597', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Academic & Experience</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div className="form-group">
                <label>Highest Qualification *</label>
                <input type="text" name="qualification" value={formData.qualification} onChange={handleInputChange} required placeholder="e.g. Ph.D. in Computer Science" />
              </div>
              <div className="form-group">
                <label>Years of Experience *</label>
                <input type="number" step="0.5" min="0" max="50" name="experience" value={formData.experience} onChange={handleInputChange} required placeholder="e.g. 5" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button type="button" className="secondary" onClick={fetchProfile} disabled={saving}>Reset to Original</button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
