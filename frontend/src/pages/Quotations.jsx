import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import DateFilter from '../components/DateFilter.jsx';
import Toast from '../components/Toast.jsx';
import { validateRequired, validatePositiveNumber } from '../utils/formValidation.js';
import { openAuthenticatedFile } from '../utils/authenticatedDownload.js';

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  // Bulk and Filter States
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [dateRange, setDateRange] = useState({ filterType: 'all', startDate: '', endDate: '' });

  // Form State
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit' | null
  const [editId, setEditId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [validDays, setValidDays] = useState(15);
  const [quotationItems, setQuotationItems] = useState([{ product: '', quantity: 1, price: 0 }]);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = async () => {
    try {
      const [qRes, custRes, prodRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/customers'),
        api.get('/products')
      ]);
      setQuotations(qRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch quotations or master profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setSelectedCustomerId('');
    setValidDays(15);
    setQuotationItems([{ product: '', quantity: 1, price: 0 }]);
    setEditId(null);
    setFormMode('add');
  };

  const handleOpenEdit = (q) => {
    setSelectedCustomerId(q.customer?._id || q.customer);
    const diffTime = Math.abs(new Date(q.validUntil) - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setValidDays(diffDays || 15);
    setQuotationItems(q.items.map(i => ({ product: i.product?._id || i.product, quantity: i.quantity, price: i.price })));
    setEditId(q._id);
    setFormMode('edit');
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...quotationItems];
    updated[index].product = prodId;
    updated[index].price = selectedProd ? selectedProd.price : 0;
    setQuotationItems(updated);
  };

  const handleItemQtyChange = (index, qty) => {
    const updated = [...quotationItems];
    updated[index].quantity = Math.max(1, Number(qty));
    setQuotationItems(updated);
  };

  const handleItemPriceChange = (index, price) => {
    const updated = [...quotationItems];
    updated[index].price = Math.max(0, Number(price));
    setQuotationItems(updated);
  };

  const handleAddItemRow = () => {
    setQuotationItems([...quotationItems, { product: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (quotationItems.length === 1) return;
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    setFormErrors({});
    const errs = {};

    if (!selectedCustomerId) errs.customer = 'Please select a customer';
    if (!quotationItems || quotationItems.length === 0 || quotationItems.some(i => !i.product)) {
      errs.items = 'Please select a valid product for all quotation items';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      setError('');
      const payload = {
        customer: selectedCustomerId,
        validDays: Number(validDays) || 15,
        items: quotationItems.map(it => ({ product: it.product, quantity: Number(it.quantity) || 1, price: Number(it.price) || 0 }))
      };
      
      if (formMode === 'edit') {
        await api.put(`/quotations/${editId}`, payload);
        setToast({ type: 'success', message: 'Quotation updated successfully! ✅' });
      } else {
        await api.post('/quotations', payload);
        setToast({ type: 'success', message: 'Quotation created successfully! ✅' });
      }
      
      setFormMode(null);
      setEditId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to submit quotation';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const handleConvertToOrder = async (id) => {
    if (!window.confirm('Are you sure you want to convert this quotation into a live dispatch order?')) return;
    const wantsLoop = window.confirm('Do you want this to be a recurring order (order loop)?');
    let recurringIntervalDays = 30;
    if (wantsLoop) {
      const days = window.prompt('Enter recurring interval in days (e.g., 30):', '30');
      if (!days) return; // Cancelled
      recurringIntervalDays = Number(days);
    }
    
    try {
      setError('');
      await api.post(`/quotations/${id}/convert`, {
        isRecurring: wantsLoop,
        recurringIntervalDays
      });
      setToast({ type: 'success', message: 'Quotation converted to live Order! ✅' });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to convert quotation to order';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const handleSendWhatsapp = async (id) => {
    try {
      setError('');
      const res = await api.post(`/quotations/${id}/whatsapp`);
      setToast({ type: 'success', message: res.data.message || 'Quotation sent successfully via WhatsApp! ✅' });
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to send WhatsApp message';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const filteredQuotations = quotations.filter(q => {
    if (selectedStatus && q.status !== selectedStatus) return false;
    if (selectedCustomer) {
      const cId = q.customer?._id || q.customer;
      if (cId !== selectedCustomer) return false;
    }
    return true;
  });

  const handleSelectAll = (evt) => {
    if (evt.target.checked) {
      setSelectedIds(filteredQuotations.map(q => q._id));
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
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected quotations?`)) return;
    try {
      setError('');
      await api.post('/bulk/delete', { model: 'quotation', ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (!status) return;
    try {
      setError('');
      await api.post('/bulk/status', { model: 'quotation', ids: selectedIds, status });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = quotations.filter(q => selectedIds.includes(q._id));
    const cleanData = dataToExport.map(q => ({
      Reference: `QTN-${q._id.toString().substring(18).toUpperCase()}`,
      Customer: q.customer?.name || q.customer,
      ItemsCount: q.items.length,
      TotalAmount: q.totalAmount,
      ValidUntil: new Date(q.validUntil).toLocaleDateString(),
      Status: q.status,
      DateCreated: new Date(q.createdAt).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotations");
    XLSX.writeFile(wb, "selected_quotations.xlsx");
  };

  const handleShareWhatsAppWeb = (quotation) => {
    if (!quotation.customer || !quotation.customer.mobile) {
      alert('Customer does not have a valid mobile number.');
      return;
    }
    let mobile = quotation.customer.mobile.replace(/\D/g, '');
    if (!mobile.startsWith('91') && mobile.length === 10) mobile = '91' + mobile;

    const validDate = new Date(quotation.validUntil).toLocaleDateString();
    let itemsText = quotation.items.map(i => `- ${i.quantity}x ${i.product?.name || 'Item'} (Rs. ${i.price.toFixed(2)})`).join('\n');
    let messageText = `*Quotation/Cost Estimate*\n\nHello ${quotation.customer.name},\n\nHere is your requested quotation for the following items:\n\n${itemsText}\n\n*Total Amount:* Rs. ${quotation.totalAmount.toFixed(2)}\n*Valid Until:* ${validDate}\n\nThank you for choosing us!`;
    
    const encodedMessage = encodeURIComponent(messageText);
    const url = `https://wa.me/${mobile}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  const handleConvertToInvoice = async (id) => {
    if (!window.confirm('Convert this Quotation into a Tax Invoice Bill? All pricing and line items will be copied automatically.')) return;
    try {
      setError('');
      const res = await api.post(`/quotations/${id}/convert-invoice`);
      alert(res.data.message || 'Quotation converted to Bill successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to convert quotation to invoice');
    }
  };

  const handlePrintPDF = async (id) => {
    try {
      await openAuthenticatedFile(`/quotations/${id}/pdf`);
    } catch (err) {
      console.error('Quotation preview failed:', err);
      setError('Failed to open the quotation PDF');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>Quotations & Cost Estimates</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Create Quotation
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'var(--bg-card, #FFFFFF)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)' }}>Status</label>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', fontSize: '13px', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Converted">Converted</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)' }}>Customer</label>
          <select 
            value={selectedCustomer} 
            onChange={(e) => setSelectedCustomer(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', fontSize: '13px', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)' }}>Date Range</label>
          <DateFilter
            value={dateRange.filterType}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', background: 'var(--bg-main, #F6F8FA)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-primary, #1F2937)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> quotations
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary, #64748B)' }}>Update Status:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', fontSize: '12px' }}
            >
              <option value="">Select...</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Converted">Converted</option>
              <option value="Expired">Expired</option>
            </select>

            <button 
              onClick={handleBulkExport}
              style={{ padding: '8px 16px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              📥 Export to Excel
            </button>
            <button 
              onClick={handleBulkDelete}
              style={{ padding: '8px 16px', background: 'var(--danger, #DC3545)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              🗑️ Bulk Delete
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              style={{ padding: '8px 16px', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-secondary, #64748B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Quotations List */}
      {loading ? (
        <div>Loading quotations...</div>
      ) : (
        <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                <th style={{ padding: '14px 20px', width: '40px' }}>
                  <input 
                    type="checkbox"
                    checked={filteredQuotations.length > 0 && selectedIds.length === filteredQuotations.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Sr. No.</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Quotation ID</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Valid Until</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Estimated Total</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.length > 0 ? (
                filteredQuotations.map((q, idx) => (
                  <tr key={q._id} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                    <td style={{ padding: '14px 20px', width: '40px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(q._id)}
                        onChange={() => handleSelectRow(q._id)}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ padding: '14px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>
                      Q-{q._id.toString().substring(18).toUpperCase()}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-primary, #1F2937)', fontWeight: '600' }}>{q.customer?.name}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary, #64748B)' }}>{new Date(q.validUntil).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-primary, #1F2937)', fontWeight: 'bold' }}>Rs. {q.totalAmount.toFixed(2)}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: 'var(--radius-sm, 4px)', 
                        fontWeight: 'bold',
                        background: q.status === 'Converted' ? 'var(--success-light, #D1E7DD)' : q.status === 'Expired' ? 'var(--danger-light, #F8D7DA)' : 'var(--primary-light, #E8F5F6)',
                        color: q.status === 'Converted' ? 'var(--success, #198754)' : q.status === 'Expired' ? 'var(--danger, #DC3545)' : 'var(--primary, #087E8B)'
                      }}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handlePrintPDF(q._id)}
                        style={{ padding: '6px 12px', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-secondary, #64748B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🖨️ PDF
                      </button>
                      {q.status !== 'Converted' && (
                        <>
                          {q.status === 'Draft' && (
                            <button 
                              onClick={() => handleOpenEdit(q)}
                              style={{ padding: '6px 12px', background: 'var(--warning-light, #FEF3C7)', color: 'var(--warning, #D97706)', border: '1px solid var(--warning-border, #FDE68A)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <button 
                            onClick={() => handleConvertToOrder(q._id)}
                            style={{ padding: '6px 12px', background: 'var(--success-light, #D1E7DD)', color: 'var(--success, #198754)', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          >
                            📦 Order
                          </button>
                          <button 
                            onClick={() => handleConvertToInvoice(q._id)}
                            style={{ padding: '6px 12px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          >
                            🧾 Bill
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No quotations found matching the filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Quotation Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23, 50, 77, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: 'var(--bg-card, #FFFFFF)', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '15px' }}>{formMode === 'edit' ? 'Edit Quotation' : 'Create Cost Estimation Quotation'}</h3>
            
            <form onSubmit={handleSubmitQuotation} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>Select Customer*</label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>Quote Validity (Days)*</label>
                <input 
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
                  required
                  min="1"
                />
              </div>

              {/* Items Section */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>Products & Quantities</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quotationItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        value={item.product}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Rs. {p.price.toFixed(2)})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                        style={{ width: '80px', padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', outline: 'none', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)' }}
                        required
                        title="Quantity"
                      />

                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main, #F6F8FA)', padding: '0 8px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', marginRight: '4px' }}>Rs.</span>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                          style={{ width: '70px', padding: '8px 0', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: 'var(--text-primary, #1F2937)' }}
                          required
                          title="Price per unit"
                        />
                      </div>

                      <div style={{ width: '80px', fontSize: '13px', color: 'var(--text-primary, #1F2937)', textAlign: 'right' }}>
                        <b>Rs. {(item.price * item.quantity).toFixed(2)}</b>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        style={{ padding: '8px 12px', background: 'var(--danger-light, #F8D7DA)', color: 'var(--danger, #DC3545)', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  onClick={handleAddItemRow}
                  style={{ marginTop: '10px', padding: '6px 12px', background: 'var(--bg-main, #F6F8FA)', color: 'var(--text-primary, #1F2937)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ➕ Add Row
                </button>
              </div>

              {/* Estimate Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light, #D9E1E7)', paddingTop: '15px', marginTop: '10px', fontWeight: 'bold', fontSize: '16px', color: 'var(--text-primary, #1F2937)' }}>
                <span>Estimated Grand Total:</span>
                <span style={{ color: 'var(--text-primary, #1F2937)' }}>Rs. {calculateTotal().toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setFormMode(null)}
                  style={{ flex: 1, padding: '10px', background: 'var(--bg-main, #F6F8FA)', color: 'var(--text-secondary, #64748B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  {formMode === 'edit' ? 'Save Changes' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'success', message: '' })}
      />

    </div>
  );
}
