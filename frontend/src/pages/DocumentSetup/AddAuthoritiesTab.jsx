import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function AddAuthoritiesTab({ triggerAlert }) {
  const [authorities, setAuthorities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingAuth, setEditingAuth] = useState(null);
  
  const initialForm = {
    employeeId: '', authorityName: '', designation: '', department: '', email: '', mobile: '',
    role: '', canApprove: false, canReject: false, canVerify: false, status: 'Active'
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchAuthorities(); }, []);

  const fetchAuthorities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/authorities');
      setAuthorities(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch authorities');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.authorityName) {
      triggerAlert('error', 'Employee ID and Authority Name are required');
      return;
    }
    try {
      if (editingAuth) {
        await api.put(`/documents/authorities/${editingAuth._id}`, formData);
        triggerAlert('success', 'Authority Updated!');
      } else {
        await api.post('/documents/authorities', formData);
        triggerAlert('success', 'New Authority Added!');
      }
      setEditingAuth(null);
      setFormData(initialForm);
      fetchAuthorities();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save authority');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this authority?')) return;
    try {
      await api.delete(`/documents/authorities/${id}`);
      triggerAlert('success', 'Deleted successfully');
      fetchAuthorities();
    } catch (err) {
      triggerAlert('error', 'Failed to delete');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
          <div className="form-group"><label>Employee ID *</label><input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} required /></div>
          <div className="form-group"><label>Authority Name *</label><input type="text" name="authorityName" value={formData.authorityName} onChange={handleChange} required /></div>
          <div className="form-group"><label>Designation</label><input type="text" name="designation" value={formData.designation} onChange={handleChange} /></div>
          <div className="form-group"><label>Department</label><input type="text" name="department" value={formData.department} onChange={handleChange} /></div>
          <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} /></div>
          <div className="form-group"><label>Mobile</label><input type="text" name="mobile" value={formData.mobile} onChange={handleChange} pattern="[0-9]{10}" title="Must be 10 digits" /></div>
          <div className="form-group"><label>Role</label><input type="text" name="role" value={formData.role} onChange={handleChange} /></div>
          <div className="form-group"><label>Status</label><select name="status" value={formData.status} onChange={handleChange}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="canApprove" checked={formData.canApprove} onChange={handleChange} /> Can Approve</label>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="canReject" checked={formData.canReject} onChange={handleChange} /> Can Reject</label>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="canVerify" checked={formData.canVerify} onChange={handleChange} /> Can Verify</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="primary">{editingAuth ? 'Update' : 'Add'}</button>
          <button type="button" className="secondary" onClick={() => { setEditingAuth(null); setFormData(initialForm); }}>Reset</button>
        </div>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Auth ID</th>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
             authorities.map(auth => (
              <tr key={auth._id}>
                <td>{auth.authorityId}</td>
                <td>{auth.employeeId}</td>
                <td>{auth.authorityName}</td>
                <td>{auth.designation}</td>
                <td>
                  {[auth.canApprove && 'Approve', auth.canReject && 'Reject', auth.canVerify && 'Verify'].filter(Boolean).join(', ') || 'None'}
                </td>
                <td><span className={`badge ${auth.status === 'Active' ? 'active' : 'inactive'}`}>{auth.status}</span></td>
                <td>
                  <button className="small secondary" onClick={() => { setEditingAuth(auth); setFormData(auth); }}>Edit</button>
                  <button className="small danger" style={{ marginLeft: '5px' }} onClick={() => handleDelete(auth._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
