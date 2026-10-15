import React, { useState } from 'react';
import api from '../services/api';
import { downloadAuthenticatedFile } from '../utils/authenticatedDownload.js';

export default function DataManagement() {
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  
  // Importer state
  const [importType, setImportType] = useState('customers');
  const [csvText, setCsvText] = useState('');
  const [importResults, setImportResults] = useState(null);

  const handleDownloadBackup = async () => {
    try {
      setError('');
      await downloadAuthenticatedFile(
        '/data/backup',
        `backup_${new Date().toISOString().split('T')[0]}.json`,
      );
      setSuccess('Database backup generated and downloaded successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to download database backup');
    }
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    
    if (!restoreFile) {
      setError('Please select a JSON backup file to upload');
      return;
    }

    if (!window.confirm('🚨 WARNING: Restoring will completely delete the active database and overwrite it with backup records. This action is irreversible. Do you want to proceed?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dump = JSON.parse(evt.target.result);
        const res = await api.post('/data/restore', dump);
        setSuccess(res.data.message || 'Database restored successfully! ✅');
        setRestoreFile(null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to parse or restore data backup file');
      }
    };
    reader.readAsText(restoreFile);
  };

  const handleCSVImport = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setImportResults(null);

    if (!csvText.trim()) {
      setError('Please enter or paste CSV lines to import');
      return;
    }

    try {
      // Parse CSV Text
      const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        setError('CSV must contain a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dataRows = [];

      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(c => c.trim());
        const rowObj = {};
        headers.forEach((header, colIdx) => {
          rowObj[header] = columns[colIdx] || '';
        });
        dataRows.push(rowObj);
      }

      const res = await api.post('/data/import-bulk', { type: importType, list: dataRows });
      setImportResults(res.data);
      setSuccess(`Import operation complete. Imported: ${res.data.imported}/${res.data.total} items!`);
      setCsvText('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to execute bulk import action');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {success && (
        <div style={{ padding: '12px', background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '8px', fontSize: '13px' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
        
        {/* Backup & Restore Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Backup Database */}
          <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', borderBottom: '1px solid var(--border-light, #D9E1E7)', paddingBottom: '10px', marginBottom: '15px' }}>💾 Download Backup</h3>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', marginBottom: '15px' }}>
              Download a backup file of your entire database (Branches, Staff, Customers, Products, Bills, Payments, and Expenses).
            </p>
            <button 
              onClick={handleDownloadBackup}
              style={{ width: '100%', padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer' }}
            >
              📥 Download Backup File
            </button>
          </div>

          {/* Restore Database */}
          <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#991b1b', borderBottom: '1px solid var(--border-light, #D9E1E7)', paddingBottom: '10px', marginBottom: '15px' }}>🚨 Restore Backup</h3>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', marginBottom: '15px' }}>
              Upload a previously downloaded backup file to restore your database. Warning: This will overwrite your current database.
            </p>
            
            <form onSubmit={handleRestoreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <input 
                  type="file" 
                  accept=".json"
                  onChange={(e) => setRestoreFile(e.target.files[0])}
                  style={{ width: '100%', fontSize: '12px' }}
                  required
                />
              </div>
              
              <button type="submit" style={{ padding: '10px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer' }}>
                ⚠️ Restore Backup Now
              </button>
            </form>
          </div>

        </div>

        {/* Excel / CSV Importer */}
        <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', borderBottom: '1px solid var(--border-light, #D9E1E7)', paddingBottom: '10px', marginBottom: '15px' }}>📥 Import Bulk Data</h3>
          
          <form onSubmit={handleCSVImport} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Import To</label>
              <select 
                value={importType} 
                onChange={(e) => setImportType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="customers">Customers List</option>
                <option value="products">Products Inventory</option>
              </select>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '11px', color: '#475569' }}>
              <strong>Expected Header format (comma-separated):</strong>
              <div style={{ marginTop: '5px', fontFamily: 'monospace', background: '#fff', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                {importType === 'customers' 
                  ? 'name,mobile,address,gstNumber,state' 
                  : 'name,category,unit,price,currentStock,lowStockThreshold,linkedVendor,hsnCode'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Paste CSV Content</label>
              <textarea 
                rows="6"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Example:\n${importType === 'customers' 
                  ? 'Ramesh Pharma,9865001122,Kothrud Pune,27RAMES1234A1Z0,Maharashtra' 
                  : 'Mox 500mg,Medicines,strips,74.50,150,10,Apex Pharma Distributors,HSN3004'}`}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', fontFamily: 'monospace' }}
              />
            </div>

            <button type="submit" style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer' }}>
              🚀 Import Bulk Data Now
            </button>
          </form>

          {/* Import Errors / Results Drawer */}
          {importResults && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>Import results summary:</h4>
              <div style={{ display: 'flex', gap: '15px', fontSize: '12px', marginBottom: '10px' }}>
                <div>Total rows: <strong>{importResults.total}</strong></div>
                <div style={{ color: '#166534' }}>Success: <strong>{importResults.imported}</strong></div>
                <div style={{ color: '#b91c1c' }}>Failed: <strong>{importResults.failures}</strong></div>
              </div>

              {importResults.errors && importResults.errors.length > 0 && (
                <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#fee2e2', borderRadius: '6px', padding: '8px', border: '1px solid #fca5a5' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#b91c1c', display: 'block', marginBottom: '5px' }}>Import Failures list:</span>
                  {importResults.errors.map((err, idx) => (
                    <div key={idx} style={{ fontSize: '10px', color: '#991b1b', marginBottom: '2px' }}>
                      Row {err.rowIndex}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
