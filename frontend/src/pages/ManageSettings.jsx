import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function ManageSettings() {
  const [settings, setSettings] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [departments, setDepartments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  
  // Inputs for adding items
  const [newDept, setNewDept] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      setAcademicYear(res.data.academicYear);
      setDepartments(res.data.departments);
      setDocumentTypes(res.data.documentTypes);
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

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', {
        academicYear,
        departments,
        documentTypes
      });
      triggerAlert('success', 'Global configuration settings updated!');
    } catch (err) {
      triggerAlert('error', 'Failed to save settings configurations');
    }
  };

  const addDepartment = () => {
    if (!newDept.trim()) return;
    if (departments.includes(newDept.trim())) {
      triggerAlert('error', 'Department already exists');
      return;
    }
    setDepartments([...departments, newDept.trim()]);
    setNewDept('');
  };

  const deleteDepartment = (dept) => {
    setDepartments(departments.filter(d => d !== dept));
  };

  const addDocument = () => {
    if (!newDoc.trim()) return;
    if (documentTypes.includes(newDoc.trim())) {
      triggerAlert('error', 'Document type already exists');
      return;
    }
    setDocumentTypes([...documentTypes, newDoc.trim()]);
    setNewDoc('');
  };

  const deleteDocument = (doc) => {
    setDocumentTypes(documentTypes.filter(d => d !== doc));
  };

  if (loading || !settings) return <div style={{ padding: '24px' }}>Loading configuration settings...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {alert.show && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
          <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
        </div>
      )}

      <div className="form-card">
        <h2 style={{ color: '#2F5597', marginBottom: '24px', borderBottom: '2px solid var(--soft-gray)', paddingBottom: '10px' }}>
          ⚙️ Manage Institute Configuration Settings
        </h2>

        <form onSubmit={handleSave}>
          {/* Academic Year */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Active Academic Year Calendar</label>
            <input
              type="text"
              placeholder="e.g. 2026-27"
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              style={{ maxWidth: '240px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Departments Setup */}
            <div>
              <h4 style={{ color: '#7030A0', marginBottom: '10px' }}>🏫 Active Departments</h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Add e.g. Mechanical Engg"
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="primary" onClick={addDepartment}>Add</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--soft-gray)', borderRadius: '6px', padding: '8px' }}>
                {departments.map(d => (
                  <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 8px', backgroundColor: 'var(--soft-gray)', borderRadius: '4px' }}>
                    <span>{d}</span>
                    <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'red' }} onClick={() => deleteDepartment(d)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents Checklist Setup */}
            <div>
              <h4 style={{ color: '#385723', marginBottom: '10px' }}>📂 Required Verification Documents</h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Add e.g. Caste Certificate"
                  value={newDoc}
                  onChange={e => setNewDoc(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="primary" onClick={addDocument}>Add</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--soft-gray)', borderRadius: '6px', padding: '8px' }}>
                {documentTypes.map(doc => (
                  <div key={doc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 8px', backgroundColor: 'var(--soft-gray)', borderRadius: '4px' }}>
                    <span>{doc}</span>
                    <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'red' }} onClick={() => deleteDocument(doc)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="btn-container">
            <button type="submit" className="primary">Save Settings Configuration</button>
          </div>
        </form>
      </div>
    </div>
  );
}
