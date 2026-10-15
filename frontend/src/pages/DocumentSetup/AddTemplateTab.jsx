import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function AddTemplateTab({ triggerAlert }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTemp, setEditingTemp] = useState(null);
  
  const initialForm = { templateName: '', richTextContent: '', header: '', footer: '', logo: '', watermark: '' };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/templates');
      setTemplates(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.templateName) {
      triggerAlert('error', 'Template Name is required');
      return;
    }
    try {
      if (editingTemp) {
        await api.put(`/documents/templates/${editingTemp._id}`, formData);
        triggerAlert('success', 'Template Updated!');
      } else {
        await api.post('/documents/templates', formData);
        triggerAlert('success', 'New Template Added!');
      }
      setEditingTemp(null);
      setFormData(initialForm);
      fetchTemplates();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/documents/templates/${id}`);
      triggerAlert('success', 'Deleted successfully');
      fetchTemplates();
    } catch (err) {
      triggerAlert('error', 'Failed to delete');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
          <div className="form-group"><label>Template Name * (e.g. Bonafide Certificate)</label><input type="text" name="templateName" value={formData.templateName} onChange={handleChange} required /></div>
          
          <div className="form-group">
            <label>Template Content (Rich Text / HTML)</label>
            <p style={{ fontSize: '12px', color: '#777', margin: '0 0 5px 0' }}>Available Variables: {'{{StudentName}}, {{RollNo}}, {{Course}}, {{Semester}}, {{AdmissionNo}}, {{IssueDate}}, {{InstituteName}}'}</p>
            <textarea name="richTextContent" value={formData.richTextContent} onChange={handleChange} rows={8} style={{ width: '100%', padding: '10px', fontFamily: 'monospace' }} placeholder="<h1>{{InstituteName}}</h1><p>This is to certify that {{StudentName}}...</p>" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group"><label>Header HTML</label><textarea name="header" value={formData.header} onChange={handleChange} rows={2} /></div>
            <div className="form-group"><label>Footer HTML</label><textarea name="footer" value={formData.footer} onChange={handleChange} rows={2} /></div>
            <div className="form-group"><label>Logo URL</label><input type="text" name="logo" value={formData.logo} onChange={handleChange} /></div>
            <div className="form-group"><label>Watermark Text/URL</label><input type="text" name="watermark" value={formData.watermark} onChange={handleChange} /></div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="primary">{editingTemp ? 'Update Template' : 'Save Template'}</button>
          <button type="button" className="secondary" onClick={() => { setEditingTemp(null); setFormData(initialForm); }}>Reset</button>
        </div>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Template Name</th>
              <th>Has Header/Footer</th>
              <th>Logo Configured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
             templates.map(t => (
              <tr key={t._id}>
                <td>{t.templateName}</td>
                <td>{t.header || t.footer ? 'Yes' : 'No'}</td>
                <td>{t.logo ? 'Yes' : 'No'}</td>
                <td>
                  <button className="small secondary" onClick={() => { setEditingTemp(t); setFormData(t); }}>Edit</button>
                  <button className="small danger" style={{ marginLeft: '5px' }} onClick={() => handleDelete(t._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
