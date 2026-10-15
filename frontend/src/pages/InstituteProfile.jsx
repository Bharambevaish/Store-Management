import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function InstituteProfile() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ name: '', address: '', contact: '', email: '', logo: '' });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/institute');
      setProfile(res.data);
      setFormData({
        name: res.data.name || '',
        address: res.data.address || '',
        contact: res.data.contact || '',
        email: res.data.email || '',
        logo: res.data.logo || ''
      });
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.contact || !formData.email) {
      triggerAlert('error', 'All fields are required.');
      return;
    }

    try {
      await api.put('/institute', formData);
      triggerAlert('success', 'Institute Profile saved successfully');
      fetchProfile();
    } catch (err) {
      triggerAlert('error', 'Failed to update institute profile');
    }
  };

  if (loading || !profile) return <div style={{ padding: '24px' }}>Loading profile files...</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      <div className="form-card">
        <h2 style={{ color: '#2F5597', marginBottom: '24px', borderBottom: '2px solid var(--soft-gray)', paddingBottom: '10px' }}>
          🏫 Manage Institute Profile Card
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '8px',
              backgroundColor: 'var(--pastel-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid var(--pastel-blue-dark)'
            }}>
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '24px' }}>🏢</span>
              )}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Upload Institute Seal / Logo (.png / .jpg)</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label>Institute Official Name *</label>
            <input
              type="text"
              placeholder="e.g. Demo Institute"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label>Official Address *</label>
            <textarea
              rows="3"
              placeholder="123 Academic Square, Science City, IN 400001"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="form-grid" style={{ marginBottom: '20px' }}>
            <div className="form-group">
              <label>Contact Number / Tel *</label>
              <input
                type="text"
                placeholder="+91-9876543210"
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
                required
                pattern="^\+?[0-9\-\s]{10,15}$"
                maxLength="15"
                title="Enter a valid 10-15 digit phone number"
              />
            </div>
            <div className="form-group">
              <label>Official Email *</label>
              <input
                type="email"
                placeholder="info@institute.edu"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value.trim() })}
                required
              />
            </div>
          </div>

          <div className="btn-container">
            <button type="submit" className="primary" style={{ padding: '10px 24px' }}>
              Save Institute Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
