import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AddFaculty() {
  const [faculties, setFaculties] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    facultyId: '',
    name: '',
    mobile: '',
    email: '',
    department: '',
    qualification: '',
    experience: '',
    photo: ''
  });

  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  useEffect(() => {
    fetchFaculty();
    fetchSettings();
  }, [search]);

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/faculty?search=${search}`);
      setFaculties(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const tempErrors = {};
    if (!formData.facultyId.trim()) tempErrors.facultyId = 'Faculty ID is required';
    if (!formData.name.trim()) tempErrors.name = 'Name is required';
    if (!formData.department) tempErrors.department = 'Department is required';
    if (!formData.qualification.trim()) tempErrors.qualification = 'Qualification is required';
    if (!formData.experience.trim()) tempErrors.experience = 'Experience is required';

    if (!/^[0-9]{10}$/.test(formData.mobile)) {
      tempErrors.mobile = 'Mobile must be exactly 10 digits';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      tempErrors.email = 'Please enter a valid email';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEditing) {
        await api.put(`/faculty/${editId}`, formData);
        triggerAlert('success', 'Faculty profile updated successfully');
      } else {
        await api.post('/faculty', formData);
        triggerAlert('success', 'Faculty profile created! Account password defaults to: faculty@123');
      }
      handleReset();
      fetchFaculty();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save faculty');
    }
  };

  const handleEdit = (f) => {
    setFormData({
      facultyId: f.facultyId,
      name: f.name,
      mobile: f.mobile,
      email: f.email,
      department: f.department,
      qualification: f.qualification,
      experience: f.experience,
      photo: f.photo || ''
    });
    setIsEditing(true);
    setEditId(f._id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this faculty profile?')) return;
    try {
      await api.delete(`/faculty/${id}`);
      triggerAlert('success', 'Faculty deleted successfully');
      fetchFaculty();
    } catch (err) {
      triggerAlert('error', 'Failed to delete faculty');
    }
  };

  const handleReset = () => {
    setFormData({
      facultyId: '',
      name: '',
      mobile: '',
      email: '',
      department: '',
      qualification: '',
      experience: '',
      photo: ''
    });
    setIsEditing(false);
    setEditId('');
    setErrors({});
  };

  return (
    <div>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        {/* Form Panel */}
        <div className="form-card">
          <h3 style={{ marginBottom: '16px', color: '#2F5597' }}>
            {isEditing ? 'Edit Faculty Member' : 'Register Faculty'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Faculty ID / Employee Code</label>
              <input
                type="text"
                placeholder="e.g. FAC101"
                value={formData.facultyId}
                onChange={e => setFormData({ ...formData, facultyId: e.target.value.toUpperCase().trim() })}
                disabled={isEditing}
                required
              />
              {errors.facultyId && <span className="inline-error">{errors.facultyId}</span>}
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Dr. Rajesh Patel"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
              {errors.name && <span className="inline-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Department</label>
              <select
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                {settings?.departments?.map(d => (
                  <option key={d} value={d}>{d}</option>
                )) || (
                  <option value="Computer Engineering">Computer Engineering</option>
                )}
              </select>
              {errors.department && <span className="inline-error">{errors.department}</span>}
            </div>

            <div className="form-group">
              <label>Qualification</label>
              <input
                type="text"
                placeholder="Ph.D in Computer Science, M.Tech"
                value={formData.qualification}
                onChange={e => setFormData({ ...formData, qualification: e.target.value })}
              />
              {errors.qualification && <span className="inline-error">{errors.qualification}</span>}
            </div>

            <div className="form-group">
              <label>Experience (Years)</label>
              <input
                type="number" step="0.5" min="0" max="50"
                placeholder="e.g. 10"
                value={formData.experience}
                onChange={e => setFormData({ ...formData, experience: e.target.value })}
              />
              {errors.experience && <span className="inline-error">{errors.experience}</span>}
            </div>

            <div className="form-group">
              <label>Mobile * (10 Digits)</label>
              <input
                type="text"
                maxLength="10"
                placeholder="9876543210"
                value={formData.mobile}
                onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/[^0-9]/g, '') })}
                pattern="[0-9]{10}" title="10 digit mobile number" required
              />
              {errors.mobile && <span className="inline-error">{errors.mobile}</span>}
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="faculty@school.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value.trim() })}
                required
              />
              {errors.email && <span className="inline-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label>Photo Upload</label>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
            </div>

            <div className="btn-container">
              <button type="button" className="secondary" onClick={handleReset}>Cancel</button>
              <button type="submit" className="primary">{isEditing ? 'Update Profile' : 'Save Faculty'}</button>
            </div>
          </form>
        </div>

        {/* Table Panel */}
        <div className="table-container">
          <div className="table-header-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search faculty name/ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>Searching employee records...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Qualification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faculties.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>No faculty profiles setup.</td>
                  </tr>
                ) : (
                  faculties.map(f => (
                    <tr key={f._id}>
                      <td>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--pastel-lavender)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {f.photo ? (
                            <img src={f.photo} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span>👨‍🏫</span>
                          )}
                        </div>
                      </td>
                      <td><strong>{f.facultyId}</strong></td>
                      <td>{f.name}</td>
                      <td>{f.department}</td>
                      <td>{f.qualification}</td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn" onClick={() => handleEdit(f)}>✏️</button>
                          <button className="icon-btn" onClick={() => handleDelete(f._id)}>🗑️</button>
                        </div>
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
