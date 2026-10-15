import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Toast from '../components/Toast.jsx';
import BulkImportModal from '../components/BulkImportModal.jsx';
import {
  validateName,
  sanitizeNameInput,
  sanitizeNumericInput,
  sanitizeTextareaInput,
  validateMobile,
  validateRequired,
  trimObjectValues
} from '../utils/formValidation.js';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  // Bulk and Filter States
  const [search, setSearch] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedPerf, setSelectedPerf] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Form State & Validation
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit' | null
  const [formData, setFormData] = useState({ name: '', contact: '', address: '', itemCategories: '', performanceScore: 100, qualityRating: 5 });
  const [formErrors, setFormErrors] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ name: '', contact: '', address: '', itemCategories: '', performanceScore: 100, qualityRating: 5 });
    setFormErrors({});
    setFormMode('add');
  };

  const handleOpenEdit = (vendor) => {
    setFormData({
      name: vendor.name,
      contact: vendor.contact,
      address: vendor.address,
      itemCategories: vendor.itemCategories ? vendor.itemCategories.join(', ') : '',
      performanceScore: vendor.performanceScore || 100,
      qualityRating: vendor.qualityRating || 5
    });
    setFormErrors({});
    setSelectedId(vendor._id);
    setFormMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    const errs = {};

    const nameErr = validateName(formData.name, 'Supplier Name');
    if (nameErr) errs.name = nameErr;

    const contactErr = validateMobile(formData.contact);
    if (contactErr) errs.contact = contactErr;

    const addrErr = validateRequired(formData.address, 'Address');
    if (addrErr) errs.address = addrErr;

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      setError('');
      const categoriesArray = formData.itemCategories
        ? formData.itemCategories.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        ...trimObjectValues(formData),
        itemCategories: categoriesArray
      };

      if (formMode === 'add') {
        await api.post('/vendors', payload);
        setToast({ type: 'success', message: 'Supplier vendor added successfully! ✅' });
      } else {
        await api.put(`/vendors/${selectedId}`, payload);
        setToast({ type: 'success', message: 'Supplier vendor updated successfully! ✅' });
      }
      setFormMode(null);
      fetchVendors();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to save vendor details';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This might affect products linked to this vendor.')) return;
    try {
      setError('');
      await api.delete(`/vendors/${id}`);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setError('Failed to delete vendor');
    }
  };

  const filteredVendors = vendors.filter(v => {
    if (search) {
      const q = search.toLowerCase();
      const matchesName = v.name.toLowerCase().includes(q);
      const matchesCat = v.itemCategories && v.itemCategories.some(c => c.toLowerCase().includes(q));
      if (!matchesName && !matchesCat) return false;
    }
    if (selectedRating) {
      const minRating = Number(selectedRating);
      if (v.qualityRating < minRating) return false;
    }
    if (selectedPerf) {
      const score = v.performanceScore || 0;
      if (selectedPerf === 'excellent' && score < 90) return false;
      if (selectedPerf === 'good' && (score < 75 || score >= 90)) return false;
      if (selectedPerf === 'poor' && score >= 75) return false;
    }
    return true;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredVendors.map(v => v._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected suppliers?`)) return;
    try {
      setError('');
      await api.post('/bulk/delete', { model: 'vendor', ids: selectedIds });
      setSelectedIds([]);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkUpdateRating = async (rating) => {
    try {
      setError('');
      await api.post('/bulk/status', { model: 'vendor', ids: selectedIds, updates: { qualityRating: Number(rating) } });
      setSelectedIds([]);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setError('Failed to update quality rating');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = vendors.filter(v => selectedIds.includes(v._id));
    const cleanData = dataToExport.map(v => ({
      Name: v.name,
      Contact: v.contact,
      Address: v.address,
      Categories: v.itemCategories ? v.itemCategories.join(', ') : '',
      QualityRating: v.qualityRating,
      PerformanceScore: v.performanceScore
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, "selected_suppliers.xlsx");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fecaca', color: '#DC3545', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#17324D' }}>Supplier Master Directory</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="🔍 Search suppliers..."
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #D9E1E7', width: '280px', outline: 'none', color: '#1F2937' }}
          />
          <button 
            onClick={() => setShowBulkImport(true)}
            style={{ padding: '10px 16px', background: '#FFFFFF', color: '#17324D', border: '1px solid #D9E1E7', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Bulk Import Excel
          </button>
          <button 
            onClick={handleOpenAdd}
            style={{ padding: '10px 20px', background: '#087E8B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
          >
            ➕ Add Vendor
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: '#FFFFFF', padding: '15px', borderRadius: '10px', border: '1px solid #D9E1E7', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>Min Quality Rating</label>
          <select 
            value={selectedRating} 
            onChange={(e) => setSelectedRating(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D9E1E7', fontSize: '13px', outline: 'none', color: '#1F2937' }}
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars only</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>Performance Status</label>
          <select 
            value={selectedPerf} 
            onChange={(e) => setSelectedPerf(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D9E1E7', fontSize: '13px', outline: 'none', color: '#1F2937' }}
          >
            <option value="">All Scores</option>
            <option value="excellent">Excellent (&gt;=90)</option>
            <option value="good">Good (75-89)</option>
            <option value="poor">Poor (&lt;75)</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', background: '#E8F5F6', padding: '15px', borderRadius: '10px', border: '1px solid #B2DFE3', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: '#087E8B', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> suppliers
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#087E8B' }}>Set Quality Rating:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkUpdateRating(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D9E1E7', background: '#FFFFFF', color: '#1F2937', fontSize: '12px' }}
            >
              <option value="">Select...</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
            <button 
              onClick={handleBulkExport}
              style={{ padding: '8px 16px', background: '#198754', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              📥 Export to Excel
            </button>
            <button 
              onClick={handleBulkDelete}
              style={{ padding: '8px 16px', background: '#DC3545', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              🗑️ Bulk Delete
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              style={{ padding: '8px 16px', background: '#FFFFFF', color: '#17324D', border: '1px solid #D9E1E7', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Vendors Table */}
      {loading ? (
        <div>Loading vendor list...</div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E1E7' }}>
                <th style={{ padding: '14px 20px', width: '40px' }}>
                  <input 
                    type="checkbox"
                    checked={filteredVendors.length > 0 && selectedIds.length === filteredVendors.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Sr. No.</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Vendor Name</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Contact Details</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Performance</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Categories Supplied</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>Address</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#17324D', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length > 0 ? (
                filteredVendors.map((v, idx) => (
                  <tr key={v._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 20px', width: '40px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(v._id)}
                        onChange={() => handleSelectRow(v._id)}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#17324D' }}>{v.name}</td>
                    <td style={{ padding: '14px 20px', color: '#1F2937' }}>{v.contact}</td>
                    <td style={{ padding: '14px 20px', color: '#1F2937' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: (v.performanceScore || 100) >= 80 ? '#dcfce7' : (v.performanceScore || 100) >= 50 ? '#fef3c7' : '#fee2e2', color: (v.performanceScore || 100) >= 80 ? '#198754' : (v.performanceScore || 100) >= 50 ? '#D97706' : '#DC3545', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                          {v.performanceScore || 100}
                        </div>
                        <div style={{ display: 'flex', color: '#D97706', fontSize: '12px' }}>
                          {'★'.repeat(v.qualityRating || 5)}{'☆'.repeat(5 - (v.qualityRating || 5))}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {v.itemCategories && v.itemCategories.length > 0 ? (
                          v.itemCategories.map((cat, i) => (
                            <span key={i} style={{ background: '#E8F5F6', color: '#087E8B', border: '1px solid #B2DFE3', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                              {cat}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>None</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B' }}>{v.address}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleOpenEdit(v)}
                        style={{ padding: '6px 12px', background: '#F6F8FA', color: '#17324D', border: '1px solid #D9E1E7', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(v._id)}
                        style={{ padding: '6px 12px', background: '#fee2e2', color: '#DC3545', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No vendors found. Add one to get started!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23, 50, 77, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #D9E1E7', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#17324D', marginBottom: '15px' }}>{formMode === 'add' ? 'Add New Supplier Vendor' : 'Edit Supplier Vendor'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Vendor Name*</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => {
                    setFormData({ ...formData, name: sanitizeNameInput(e.target.value) });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder="e.g. Acme Pharmaceuticals Ltd"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.name ? '#DC3545' : '#D9E1E7'}`, outline: 'none' }}
                />
                {formErrors.name && <span style={{ color: '#DC3545', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.name}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Contact Phone/Mobile*</label>
                <input 
                  type="tel" 
                  maxLength={10}
                  value={formData.contact} 
                  onChange={(e) => {
                    setFormData({ ...formData, contact: sanitizeNumericInput(e.target.value, 10) });
                    if (formErrors.contact) setFormErrors({ ...formErrors, contact: '' });
                  }}
                  placeholder="10-digit primary mobile"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.contact ? '#DC3545' : '#D9E1E7'}`, outline: 'none' }}
                />
                {formErrors.contact && <span style={{ color: '#DC3545', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.contact}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Address*</label>
                <textarea 
                  value={formData.address} 
                  onChange={(e) => {
                    setFormData({ ...formData, address: sanitizeTextareaInput(e.target.value) });
                    if (formErrors.address) setFormErrors({ ...formErrors, address: '' });
                  }}
                  rows="3"
                  placeholder="Official registered address..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.address ? '#DC3545' : '#D9E1E7'}`, outline: 'none' }}
                />
                {formErrors.address && <span style={{ color: '#DC3545', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.address}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Item Categories Supplied (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.itemCategories} 
                  onChange={(e) => setFormData({ ...formData, itemCategories: e.target.value })}
                  placeholder="e.g. Antibiotics, Surgical, Syringes"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D9E1E7', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Performance Score (0-100)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={formData.performanceScore} 
                    onChange={(e) => setFormData({ ...formData, performanceScore: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D9E1E7', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Quality Rating (1-5)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="5"
                    value={formData.qualityRating} 
                    onChange={(e) => setFormData({ ...formData, qualityRating: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D9E1E7', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setFormMode(null)}
                  style={{ flex: 1, padding: '10px', background: '#FFFFFF', color: '#17324D', border: '1px solid #D9E1E7', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: '#087E8B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        type="suppliers"
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => {
          fetchVendors();
          setToast({ type: 'success', message: 'Suppliers imported successfully! ✅' });
        }}
      />

      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'success', message: '' })}
      />

    </div>
  );
}
