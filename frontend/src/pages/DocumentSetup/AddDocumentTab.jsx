import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function AddDocumentTab({ triggerAlert }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  
  const initialForm = {
    documentTitle: '', description: '', category: '', documentType: '', applicableFor: '',
    isMandatory: false, allowUpload: true, allowMultipleFiles: false, maxFileSize: 2,
    allowedFileTypes: '.pdf,.png,.jpg', displayOrder: 0, status: 'Active'
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchDocuments(); }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/setup');
      setDocuments(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch documents');
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
    if (!formData.documentTitle) {
      triggerAlert('error', 'Document Title is required');
      return;
    }
    try {
      if (editingDoc) {
        await api.put(`/documents/setup/${editingDoc._id}`, formData);
        triggerAlert('success', 'Document Configuration Updated!');
      } else {
        await api.post('/documents/setup', formData);
        triggerAlert('success', 'New Document Type Added!');
      }
      setEditingDoc(null);
      setFormData(initialForm);
      fetchDocuments();
    } catch (err) {
      triggerAlert('error', err.response?.data?.error || 'Failed to save document');
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({ ...doc });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document type?')) return;
    try {
      await api.delete(`/documents/setup/${id}`);
      triggerAlert('success', 'Deleted successfully');
      fetchDocuments();
    } catch (err) {
      triggerAlert('error', 'Failed to delete');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div className="form-group"><label>Document Title *</label><input type="text" name="documentTitle" value={formData.documentTitle} onChange={handleChange} required /></div>
          <div className="form-group"><label>Description</label><input type="text" name="description" value={formData.description} onChange={handleChange} /></div>
          <div className="form-group"><label>Category</label><input type="text" name="category" value={formData.category} onChange={handleChange} /></div>
          <div className="form-group"><label>Document Type</label><input type="text" name="documentType" value={formData.documentType} onChange={handleChange} /></div>
          <div className="form-group"><label>Applicable For</label><input type="text" name="applicableFor" value={formData.applicableFor} onChange={handleChange} /></div>
          <div className="form-group"><label>Maximum File Size (MB)</label><input type="number" name="maxFileSize" value={formData.maxFileSize} onChange={handleChange} /></div>
          <div className="form-group"><label>Allowed File Types</label><input type="text" name="allowedFileTypes" value={formData.allowedFileTypes} onChange={handleChange} /></div>
          <div className="form-group"><label>Display Order</label><input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleChange} /></div>
          <div className="form-group"><label>Status</label><select name="status" value={formData.status} onChange={handleChange}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="isMandatory" checked={formData.isMandatory} onChange={handleChange} /> Is Mandatory</label>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="allowUpload" checked={formData.allowUpload} onChange={handleChange} /> Allow Upload</label>
          <label style={{ cursor: 'pointer' }}><input type="checkbox" name="allowMultipleFiles" checked={formData.allowMultipleFiles} onChange={handleChange} /> Allow Multiple</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="primary">{editingDoc ? 'Update' : 'Add'}</button>
          <button type="button" className="secondary" onClick={() => { setEditingDoc(null); setFormData(initialForm); }}>Reset</button>
        </div>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Applicable For</th>
              <th>Mandatory</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
             documents.map(doc => (
              <tr key={doc._id}>
                <td>{doc.documentId}</td>
                <td>{doc.documentTitle}</td>
                <td>{doc.documentType}</td>
                <td>{doc.applicableFor}</td>
                <td>{doc.isMandatory ? 'Yes' : 'No'}</td>
                <td><span className={`badge ${doc.status === 'Active' ? 'active' : 'inactive'}`}>{doc.status}</span></td>
                <td>
                  <button className="small secondary" onClick={() => handleEdit(doc)}>Edit</button>
                  <button className="small danger" style={{ marginLeft: '5px' }} onClick={() => handleDelete(doc._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
