import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function AddApprovalPathTab({ triggerAlert }) {
  const [paths, setPaths] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPath, setEditingPath] = useState(null);
  
  const [formData, setFormData] = useState({ pathName: '', status: 'Active', steps: [] });
  const [newStep, setNewStep] = useState({ authorityId: '', actionType: 'Approve' });

  useEffect(() => { 
    fetchPaths(); 
    fetchAuthorities();
  }, []);

  const fetchPaths = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/approval-paths');
      setPaths(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch paths');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthorities = async () => {
    try {
      const res = await api.get('/documents/authorities');
      setAuthorities(res.data.filter(a => a.status === 'Active'));
    } catch (err) {}
  };

  const handleStepAdd = () => {
    if (!newStep.authorityId) {
      triggerAlert('error', 'Select an authority');
      return;
    }
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { ...newStep, order: prev.steps.length + 1 }]
    }));
    setNewStep({ authorityId: '', actionType: 'Approve' });
  };

  const handleStepRemove = (index) => {
    const updated = [...formData.steps];
    updated.splice(index, 1);
    // Reorder
    updated.forEach((s, i) => s.order = i + 1);
    setFormData(prev => ({ ...prev, steps: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pathName || formData.steps.length === 0) {
      triggerAlert('error', 'Path name and at least one step required');
      return;
    }
    try {
      if (editingPath) {
        await api.put(`/documents/approval-paths/${editingPath._id}`, formData);
        triggerAlert('success', 'Path Updated!');
      } else {
        await api.post('/documents/approval-paths', formData);
        triggerAlert('success', 'New Path Added!');
      }
      setEditingPath(null);
      setFormData({ pathName: '', status: 'Active', steps: [] });
      fetchPaths();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save path');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this approval path?')) return;
    try {
      await api.delete(`/documents/approval-paths/${id}`);
      triggerAlert('success', 'Deleted successfully');
      fetchPaths();
    } catch (err) {
      triggerAlert('error', 'Failed to delete');
    }
  };

  const getAuthorityName = (id) => {
    // some might be populated objects, some strings
    const authId = typeof id === 'object' && id !== null ? id._id : id;
    const auth = authorities.find(a => a._id === authId);
    return auth ? auth.authorityName : 'Unknown';
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#2F5597' }}>{editingPath ? 'Edit Workflow' : 'Build New Workflow'}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div className="form-group"><label>Path Name *</label><input type="text" value={formData.pathName} onChange={e => setFormData({...formData, pathName: e.target.value})} required placeholder="e.g. Student Upload Workflow" /></div>
          <div className="form-group"><label>Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
        </div>

        <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          <h5>Add Step to Workflow</h5>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label>Select Authority</label>
              <select value={newStep.authorityId} onChange={e => setNewStep({...newStep, authorityId: e.target.value})}>
                <option value="">-- Select Authority --</option>
                {authorities.map(a => <option key={a._id} value={a._id}>{a.authorityName} ({a.designation})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Action Type</label>
              <select value={newStep.actionType} onChange={e => setNewStep({...newStep, actionType: e.target.value})}>
                <option value="Verify">Verify</option><option value="Approve">Approve</option>
              </select>
            </div>
            <button type="button" className="secondary" onClick={handleStepAdd}>Add Step</button>
          </div>
        </div>

        {formData.steps.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h5>Current Workflow Sequence:</h5>
            <ol style={{ paddingLeft: '20px', marginTop: '10px' }}>
              {formData.steps.map((step, idx) => (
                <li key={idx} style={{ padding: '5px 0' }}>
                  <strong>{getAuthorityName(step.authorityId)}</strong> will <em>{step.actionType}</em>
                  <button type="button" style={{ marginLeft: '10px', color: 'red', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleStepRemove(idx)}>✖</button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="submit" className="primary">{editingPath ? 'Update Path' : 'Save Path'}</button>
          <button type="button" className="secondary" onClick={() => { setEditingPath(null); setFormData({ pathName: '', status: 'Active', steps: [] }); }}>Reset</button>
        </div>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Path Name</th>
              <th>Total Steps</th>
              <th>Sequence (Authority → Action)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
             paths.map(p => (
              <tr key={p._id}>
                <td>{p.pathName}</td>
                <td>{p.steps.length}</td>
                <td>
                  {p.steps.map((s, i) => (
                    <span key={i}>
                      {s.authorityId?.authorityName || 'Unknown'} ({s.actionType})
                      {i < p.steps.length - 1 ? ' ➔ ' : ''}
                    </span>
                  ))}
                </td>
                <td><span className={`badge ${p.status === 'Active' ? 'active' : 'inactive'}`}>{p.status}</span></td>
                <td>
                  <button className="small secondary" onClick={() => { setEditingPath(p); setFormData({ pathName: p.pathName, status: p.status, steps: p.steps.map(s => ({ authorityId: s.authorityId?._id || s.authorityId, actionType: s.actionType, order: s.order })) }); }}>Edit</button>
                  <button className="small danger" style={{ marginLeft: '5px' }} onClick={() => handleDelete(p._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
