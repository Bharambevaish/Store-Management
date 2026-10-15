import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function DocumentSettingsTab({ triggerAlert }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/documents/settings');
      setSettings(res.data);
    } catch (err) {
      triggerAlert('error', 'Failed to fetch settings');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/documents/settings', settings);
      triggerAlert('success', 'Global Document Settings saved successfully.');
    } catch (err) {
      triggerAlert('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p>Loading settings...</p>;

  return (
    <form onSubmit={handleSave}>
      <h3 style={{ marginBottom: '15px', color: '#2F5597' }}>Global Configuration</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div className="form-group"><label>Default Upload Path</label><input type="text" name="defaultUploadPath" value={settings.defaultUploadPath} onChange={handleChange} /></div>
        <div className="form-group"><label>Max Upload Size (MB)</label><input type="number" name="maximumUploadSize" value={settings.maximumUploadSize} onChange={handleChange} /></div>
        <div className="form-group"><label>Allowed File Extensions</label><input type="text" name="allowedFileExtensions" value={settings.allowedFileExtensions} onChange={handleChange} /></div>
        <div className="form-group"><label>Duplicate Upload Policy</label>
          <select name="duplicateUploadPolicy" value={settings.duplicateUploadPolicy} onChange={handleChange}>
            <option value="Overwrite">Overwrite</option><option value="Reject">Reject</option><option value="Keep Both">Keep Both</option>
          </select>
        </div>
      </div>
      
      <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#2F5597' }}>Feature Toggles</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="imageCompression" checked={settings.imageCompression} onChange={handleChange} /> Image Compression</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="pdfPreview" checked={settings.pdfPreview} onChange={handleChange} /> PDF Preview</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="autoRenameFiles" checked={settings.autoRenameFiles} onChange={handleChange} /> Auto Rename Files</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="documentVersioning" checked={settings.documentVersioning} onChange={handleChange} /> Document Versioning</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="softDelete" checked={settings.softDelete} onChange={handleChange} /> Soft Delete</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="enableAuditLogs" checked={settings.enableAuditLogs} onChange={handleChange} /> Enable Audit Logs</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="enableDocumentVerification" checked={settings.enableDocumentVerification} onChange={handleChange} /> Document Verification</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="enableDigitalSignature" checked={settings.enableDigitalSignature} onChange={handleChange} /> Digital Signature</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="enableDownloadPermission" checked={settings.enableDownloadPermission} onChange={handleChange} /> Download Permission</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" name="enablePrintPermission" checked={settings.enablePrintPermission} onChange={handleChange} /> Print Permission</label>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
      </div>
    </form>
  );
}
