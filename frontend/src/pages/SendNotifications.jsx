import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SendNotifications({ type = 'broadcast' }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', message: '', recipientRole: 'All' });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  // Re-fetch when type changes
  useEffect(() => {
    fetchNotifications();
    setFormData({ title: '', message: '', recipientRole: 'All' });
  }, [type]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?type=${type}`);
      setNotifications(res.data);
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
    if (!formData.title.trim() || !formData.message.trim()) {
      triggerAlert('error', 'Notification Title and Message are required');
      return;
    }

    try {
      await api.post('/notifications', { ...formData, type, sender: 'Admin' });
      triggerAlert('success', type === 'birthday' ? 'Birthday wishes sent successfully!' : 'Notification broadcasted successfully!');
      setFormData({ title: '', message: '', recipientRole: 'All' });
      fetchNotifications();
    } catch (err) {
      triggerAlert('error', 'Failed to send notification');
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

      {/* Broadcast Form */}
      <div className="form-card">
        <h3 style={{ color: type === 'birthday' ? '#D81B60' : '#2F5597', marginBottom: '16px' }}>
          {type === 'birthday' ? '🎂 Send Birthday Wishes' : '📣 Broadcast Announcement'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>Notification Title *</label>
            <input
              type="text"
              placeholder="e.g. Summer Examination Schedule"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>{type === 'birthday' ? 'Wishes Message *' : 'Announce Message *'}</label>
            <textarea
              rows="4"
              placeholder={type === 'birthday' ? 'Enter a birthday greeting...' : 'Enter details of announcement...'}
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Target Audience *</label>
            <select
              value={formData.recipientRole}
              onChange={e => setFormData({ ...formData, recipientRole: e.target.value })}
            >
              <option value="All">All Students and Faculty</option>
              <option value="Faculty">Faculty Only</option>
              <option value="Student">Students Only</option>
            </select>
          </div>

          <button type="submit" className="primary" style={{ width: '100%', backgroundColor: type === 'birthday' ? '#D81B60' : 'var(--primary-color)' }}>
            {type === 'birthday' ? 'Send Wishes' : 'Send Announcement'}
          </button>
        </form>
      </div>

      {/* History Log */}
      <div className="table-container">
        <div className="table-header-bar" style={{ backgroundColor: type === 'birthday' ? '#FADADD' : 'var(--pastel-blue-dark)' }}>
          <h4 style={{ margin: 0, color: type === 'birthday' ? '#880E4F' : 'var(--primary-color)' }}>
            {type === 'birthday' ? 'Birthday Wishes Log' : 'Broadcast Logs History'}
          </h4>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading histories...</div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ color: '#7F7F7F', textAlign: 'center', fontSize: '13px' }}>
                {type === 'birthday' ? 'No birthday wishes sent yet.' : 'No broadcasts sent yet.'}
              </p>
            ) : (
              notifications.map(notif => (
                <div key={notif._id} style={{
                  padding: '14px',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: type === 'birthday' ? '#FFF0F5' : 'var(--pastel-blue)',
                  border: `1px solid ${type === 'birthday' ? '#FADADD' : 'var(--pastel-blue-dark)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ color: type === 'birthday' ? '#D81B60' : '#2F5597' }}>
                      {type === 'birthday' ? '🎈 ' : ''}{notif.title}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#595959' }}>
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', margin: '6px 0', lineHeight: '1.4' }}>{notif.message}</p>
                  <div style={{ fontSize: '10px', color: '#7F7F7F', borderTop: '1px solid #D9D9D9', paddingTop: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sender: <strong>{notif.sender}</strong></span>
                    <span>Audience: <strong>{notif.recipientRole}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
