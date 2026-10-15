import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import DateFilter from '../components/DateFilter.jsx';
import Toast from '../components/Toast.jsx';
import { validateRequired, validatePositiveNumber } from '../utils/formValidation.js';
import { X } from 'lucide-react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Bulk and Filter States
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [dateRange, setDateRange] = useState({ filterType: 'all', startDate: '', endDate: '' });

  const [payModal, setPayModal] = useState(false);
  const [payData, setPayData] = useState({ customerId: '', amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '', autoAllocate: true });
  const [payErrors, setPayErrors] = useState({});

  const fetchPayments = async () => {
    try {
      const [payRes, branchRes] = await Promise.all([
        api.get('/payments'),
        api.get('/branches')
      ]);
      setPayments(payRes.data);
      setBranches(branchRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch payment collections');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
  }, []);

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setPayErrors({});
    const errs = {};

    if (!payData.customerId) errs.customerId = 'Customer selection is required';

    const amtErr = validatePositiveNumber(payData.amountPaid, 'Amount Paid', false);
    if (amtErr) errs.amountPaid = amtErr;

    if (Object.keys(errs).length > 0) {
      setPayErrors(errs);
      return;
    }

    try {
      setError('');
      const payload = {
        customerId: payData.customerId,
        amountPaid: Number(payData.amountPaid),
        paymentMode: payData.paymentMode,
        referenceNumber: payData.referenceNumber ? payData.referenceNumber.trim() : '',
        notes: payData.notes ? payData.notes.trim() : '',
        autoAllocate: payData.autoAllocate
      };

      await api.post('/payments', payload);
      setToast({ type: 'success', message: 'Payment recorded successfully! ✅' });
      setPayModal(false);
      fetchPayments();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to log payment';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const filteredPayments = payments.filter(p => {
    if (selectedCustomer) {
      const cId = p.customer?._id || p.customer;
      if (cId !== selectedCustomer) return false;
    }
    if (selectedPaymentMode && p.paymentMode !== selectedPaymentMode) return false;
    if (selectedBranch) {
      const bId = p.branch?._id || p.branch;
      if (bId !== selectedBranch) return false;
    }
    return true;
  });

  const handleSelectAll = (evt) => {
    if (evt.target.checked) {
      setSelectedIds(filteredPayments.map(p => p._id));
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
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected payments?`)) return;
    try {
      setError('');
      await api.post('/bulk/delete', { model: 'payment', ids: selectedIds });
      setSelectedIds([]);
      fetchPayments();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = payments.filter(p => selectedIds.includes(p._id));
    const cleanData = dataToExport.map(p => ({
      Customer: p.customer?.name || p.customer,
      AmountPaid: p.amountPaid,
      PaymentMode: p.paymentMode,
      ReferenceNumber: p.referenceNumber || '',
      Notes: p.notes || '',
      DatePaid: new Date(p.createdAt).toLocaleDateString(),
      Branch: p.branch?.name || p.branch
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, "selected_payments.xlsx");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Payment Collection Register</h2>
        <button 
          onClick={() => {
            setPayData({ customerId: '', amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '', autoAllocate: true });
            setPayModal(true);
          }}
          style={{ padding: '8px 16px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Log Payment
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: '#fff', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Customer</label>
          <select 
            value={selectedCustomer} 
            onChange={(e) => setSelectedCustomer(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Payment Mode</label>
          <select 
            value={selectedPaymentMode} 
            onChange={(e) => setSelectedPaymentMode(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Modes</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Cheque">Cheque</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Date Range</label>
          <DateFilter
            value={dateRange.filterType}
            onChange={setDateRange}
          />
        </div>

        {branches.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Branch</label>
            <select 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', background: 'var(--bg-main, #F6F8FA)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--primary, #087E8B)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> payment entries
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleBulkExport}
              style={{ padding: '8px 16px', background: 'var(--success, #198754)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
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
              style={{ padding: '8px 16px', background: 'var(--border-subtle, #F1F5F9)', color: 'var(--text-primary, #1F2937)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                <th style={{ padding: '14px 20px', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    id="select-all-payments"
                    aria-label="Select all payments"
                    checked={filteredPayments.length > 0 && selectedIds.length === filteredPayments.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Sr. No.</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Collection Date</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Invoice Bill Ref</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Amount Collected</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Payment Mode</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Reference / Auth ID</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p, idx) => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', width: '40px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(p._id)}
                        onChange={() => handleSelectRow(p._id)}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#1e293b' }}>
                      {p.customer?.name || 'Walk-in / Anonymous'}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--primary, #087E8B)', fontWeight: '700' }}>
                      {p.bill?.invoiceNumber || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>
                      Rs. {p.amountPaid.toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        background: '#f1f5f9',
                        color: '#475569',
                        textTransform: 'uppercase'
                      }}>
                        {p.paymentMode}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      {p.referenceNumber || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>
                      {p.notes || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No payments found matching the filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {/* Record General Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{
            background: '#fff',
            borderRadius: '14px',
            padding: '24px',
            width: '100%',
            maxWidth: payData.paymentMode === 'UPI' ? '700px' : '440px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            transition: 'max-width 0.2s ease',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Log General Payment</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Record customer collection. Auto-allocates via FIFO if checked.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setPayModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSavePayment}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: payData.paymentMode === 'UPI' ? '1fr 1fr' : '1fr',
                gap: '20px',
                alignItems: 'start'
              }}>
                {/* Form Fields Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Customer*</label>
                    <select 
                      value={payData.customerId}
                      onChange={(e) => setPayData({ ...payData, customerId: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                      required
                    >
                      <option value="">Select Customer...</option>
                      {customers.map(c => (
                        <option key={c._id} value={c._id}>{c.name} ({c.mobile})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Amount Paid (Rs.)*</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={payData.amountPaid}
                      onChange={(e) => setPayData({ ...payData, amountPaid: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Payment Mode*</label>
                    <select 
                      value={payData.paymentMode}
                      onChange={(e) => setPayData({ ...payData, paymentMode: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="cash">Cash Payment</option>
                      <option value="bank transfer">Bank IMPS / NEFT Transfer</option>
                      <option value="cheque">Bank Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Transaction Ref Number</label>
                    <input 
                      type="text"
                      placeholder="e.g. Bank/UPI Transaction ID"
                      value={payData.referenceNumber}
                      onChange={(e) => setPayData({ ...payData, referenceNumber: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                      <input 
                        type="checkbox" 
                        checked={payData.autoAllocate} 
                        onChange={e => setPayData({ ...payData, autoAllocate: e.target.checked })} 
                      />
                      Auto-allocate (FIFO)
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Notes</label>
                    <input 
                      type="text"
                      value={payData.notes}
                      onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* UPI QR Side Column */}
                {payData.paymentMode === 'UPI' && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1.5px solid #087E8B',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: '8px',
                    height: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#087E8B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Counter UPI Payment
                    </div>
                    <div style={{
                      background: '#ffffff',
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                      display: 'inline-block'
                    }}>
                      <img 
                        src="/assets/payment-qr.png" 
                        alt="UPI Payment QR Code - Krishna Tammewar" 
                        style={{
                          width: '145px',
                          height: '145px',
                          display: 'block',
                          imageRendering: 'crisp-edges'
                        }} 
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>
                        Krishna Tammewar
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#087E8B', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                          tammewark@okicici
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        Scan via GPay, PhonePe, Paytm or UPI
                      </div>
                      {payData.amountPaid && Number(payData.amountPaid) > 0 && (
                        <div style={{ marginTop: '6px', fontWeight: '800', color: '#166534', fontSize: '13px', background: '#dcfce7', padding: '3px 10px', borderRadius: '6px', display: 'inline-block' }}>
                          Amount: Rs. {Number(payData.amountPaid).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <button 
                  type="button" 
                  onClick={() => setPayModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Submit Payment
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
