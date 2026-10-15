import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AcademicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', type: 'Event', startDate: '', endDate: '' });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/calendar');
      setEvents(res.data);
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
    if (!formData.title || !formData.startDate || !formData.endDate) {
      triggerAlert('error', 'Title, Start Date, and End Date are required');
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/calendar/${editId}`, formData);
        triggerAlert('success', 'Calendar event updated successfully');
      } else {
        await api.post('/calendar', formData);
        triggerAlert('success', 'Calendar event added successfully');
      }
      handleReset();
      fetchEvents();
    } catch (err) {
      triggerAlert('error', 'Failed to save calendar event');
    }
  };

  const handleEdit = (evt) => {
    setFormData({
      title: evt.title,
      description: evt.description || '',
      type: evt.type,
      startDate: evt.startDate.substring(0, 10),
      endDate: evt.endDate.substring(0, 10)
    });
    setIsEditing(true);
    setEditId(evt._id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/calendar/${id}`);
      triggerAlert('success', 'Calendar event deleted');
      fetchEvents();
    } catch (err) {
      triggerAlert('error', 'Failed to delete event');
    }
  };

  const handleReset = () => {
    setFormData({ title: '', description: '', type: 'Event', startDate: '', endDate: '' });
    setIsEditing(false);
    setEditId('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`} style={{ gridColumn: '1 / -1' }}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      {/* Calendar Form */}
      <div className="form-card">
        <h3 style={{ color: '#2F5597', marginBottom: '16px' }}>
          {isEditing ? 'Edit Calendar Event' : 'Add Calendar Event'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>Event Title *</label>
            <input
              type="text"
              placeholder="e.g. Mid-term Practicals"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="Provide event details..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Event Type *</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="Event">Event / Seminar</option>
              <option value="Holiday">Holiday</option>
              <option value="Exam">Examination Schedule</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>End Date *</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
              required
            />
          </div>

          <div className="btn-container">
            <button type="button" className="secondary" onClick={handleReset}>Cancel</button>
            <button type="submit" className="primary">{isEditing ? 'Update Event' : 'Save Event'}</button>
          </div>
        </form>
      </div>

      {/* Calendar List */}
      <div className="table-container">
        <div className="table-header-bar">
          <h4 style={{ margin: 0 }}>Upcoming Academic Schedules</h4>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading schedule...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Schedule Title</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>No calendar events scheduled.</td>
                </tr>
              ) : (
                events.map(evt => (
                  <tr key={evt._id}>
                    <td>
                      <strong>{evt.title}</strong>
                      <div style={{ fontSize: '11px', color: '#7F7F7F' }}>{evt.description}</div>
                    </td>
                    <td>
                      <span className={`badge ${evt.type === 'Exam' ? 'inactive' : evt.type === 'Holiday' ? 'pending' : 'active'}`}>
                        {evt.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>
                        {new Date(evt.startDate).toLocaleDateString()} - {new Date(evt.endDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => handleEdit(evt)}>✏️</button>
                        <button className="icon-btn" onClick={() => handleDelete(evt._id)}>🗑️</button>
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
  );
}
