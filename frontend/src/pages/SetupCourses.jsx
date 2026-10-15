import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SetupCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ courseId: '', name: '', department: '', duration: 8 });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchCourses();
  }, [search]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/courses?search=${search}`);
      setCourses(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch courses');
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
    if (!formData.courseId || !formData.name || !formData.department || !formData.duration) {
      triggerAlert('error', 'Please fill in all fields');
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/courses/${editId}`, formData);
        triggerAlert('success', 'Course updated successfully');
      } else {
        await api.post('/courses', formData);
        triggerAlert('success', 'Course added successfully');
      }
      resetForm();
      fetchCourses();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save course');
    }
  };

  const handleEdit = (c) => {
    setFormData({ courseId: c.courseId, name: c.name, department: c.department, duration: c.duration });
    setIsEditing(true);
    setEditId(c._id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      triggerAlert('success', 'Course deleted successfully');
      fetchCourses();
    } catch (err) {
      triggerAlert('error', 'Failed to delete course');
    }
  };

  const resetForm = () => {
    setFormData({ courseId: '', name: '', department: '', duration: 8 });
    setIsEditing(false);
    setEditId('');
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
        {/* Course Form */}
        <div className="form-card">
          <h3 style={{ marginBottom: '16px', color: '#2F5597' }}>{isEditing ? 'Edit Course' : 'Create New Course'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Course ID / Code</label>
              <input
                type="text"
                placeholder="e.g. BTECH-CE"
                value={formData.courseId}
                onChange={e => setFormData({ ...formData, courseId: e.target.value.toUpperCase() })}
                disabled={isEditing}
              />
            </div>

            <div className="form-group">
              <label>Course Name</label>
              <input
                type="text"
                placeholder="e.g. Bachelor of Technology in Computer Engineering"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Department</label>
              <select
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                <option value="Computer Engineering">Computer Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Civil Engineering">Civil Engineering</option>
              </select>
            </div>

            <div className="form-group">
              <label>Duration (Semesters)</label>
              <input
                type="number"
                min="1"
                max="12"
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
              />
            </div>

            <div className="btn-container">
              <button type="button" className="secondary" onClick={resetForm}>Reset</button>
              <button type="submit" className="primary">{isEditing ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>

        {/* Courses Table */}
        <div>
          <div className="table-container">
            <div className="table-header-bar">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search courses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Semesters</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center' }}>No courses set up yet.</td>
                    </tr>
                  ) : (
                    courses.map(c => (
                      <tr key={c._id}>
                        <td><strong>{c.courseId}</strong></td>
                        <td>{c.name}</td>
                        <td>{c.department}</td>
                        <td>{c.duration}</td>
                        <td>
                          <div className="table-actions">
                            <button className="icon-btn" title="Edit" onClick={() => handleEdit(c)}>✏️</button>
                            <button className="icon-btn" title="Delete" onClick={() => handleDelete(c._id)}>🗑️</button>
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
    </div>
  );
}
