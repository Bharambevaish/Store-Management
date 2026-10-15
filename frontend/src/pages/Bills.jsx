import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import DateFilter from '../components/DateFilter.jsx';
import Toast from '../components/Toast.jsx';
import { downloadAuthenticatedFile, openAuthenticatedFile } from '../utils/authenticatedDownload.js';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Bulk and Filter States
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Timeframe and Date Filtering States
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Payment Record Modal State
  const [payModal, setPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payData, setPayData] = useState({ amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '' });

  // Interactive View Bill Modal (Physical Retail Memo Bill Book UI Structure)
  const [viewBillModal, setViewBillModal] = useState(false);
  const [selectedViewBill, setSelectedViewBill] = useState(null);

  // WhatsApp Reminder Modal State
  const [reminderModal, setReminderModal] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState(null);
  const [reminderLanguage, setReminderLanguage] = useState('english');
  const [outstandingDues, setOutstandingDues] = useState(0);

  const fetchBills = async () => {
    try {
      const [billsRes, branchRes, paymentsRes, settingsRes] = await Promise.all([
        api.get('/bills'),
        api.get('/branches'),
        api.get('/payments'),
        api.get('/settings')
      ]);
      setBills(billsRes.data);
      setBranches(branchRes.data);
      setPayments(paymentsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const filteredBills = bills.filter(b => {
    if (selectedPaymentStatus && b.paymentStatus !== selectedPaymentStatus) return false;
    if (selectedBranch) {
      const bId = b.branch?._id || b.branch;
      if (bId !== selectedBranch) return false;
    }

    if (dateFilterType !== 'all') {
      const bDate = new Date(b.createdAt);
      const now = new Date();

      if (dateFilterType === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (bDate < todayStart) return false;
      } 
      else if (dateFilterType === 'this_week') {
        const weekStart = new Date(now);
        const currentDay = weekStart.getDay();
        const diff = weekStart.getDate() - currentDay;
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        if (bDate < weekStart) return false;
      } 
      else if (dateFilterType === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (bDate < monthStart) return false;
      } 
      else if (dateFilterType === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (bDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (bDate > end) return false;
        }
      }
    }
    return true;
  });

  const getBillPaymentDetails = (bill) => {
    const paidFromPayments = payments
      .filter(p => p.bill && (p.bill._id === bill._id || p.bill === bill._id))
      .reduce((sum, p) => sum + p.amountPaid, 0);
    
    const paidAmount = bill.status === 'Paid' ? bill.totalAmount : paidFromPayments;
    const pendingAmount = Math.max(0, bill.totalAmount - paidAmount);
    return { paid: paidAmount, pending: pendingAmount };
  };

  const stats = filteredBills.reduce((acc, b) => {
    acc.totalInvoiced += b.totalAmount || 0;
    const details = getBillPaymentDetails(b);
    acc.totalPaid += details.paid;
    acc.totalPending += details.pending;
    return acc;
  }, { totalInvoiced: 0, totalPaid: 0, totalPending: 0 });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredBills.map(b => b._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected bills?`)) return;
    try {
      setError('');
      await api.post('/bulk/delete', { model: 'bill', ids: selectedIds });
      setSelectedIds([]);
      fetchBills();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (!status) return;
    try {
      setError('');
      await api.post('/bulk/status', { model: 'bill', ids: selectedIds, status });
      setSelectedIds([]);
      fetchBills();
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = bills.filter(b => selectedIds.includes(b._id));
    const cleanData = dataToExport.map(b => ({
      InvoiceNumber: b.invoiceNumber,
      Customer: b.customer?.name || b.customer,
      Subtotal: b.subtotal,
      TotalAmount: b.totalAmount,
      Status: b.status,
      PaymentStatus: b.paymentStatus || 'Pending',
      Branch: b.branch?.name || b.branch,
      DateCreated: new Date(b.createdAt).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, "selected_invoices.xlsx");
  };

  const handleOpenPaymentModal = (bill) => {
    setSelectedBill(bill);
    setPayData({
      amountPaid: bill.totalAmount.toString(),
      paymentMode: 'UPI',
      referenceNumber: '',
      notes: ''
    });
    setPayModal(true);
  };

  const handleOpenViewBillModal = (bill) => {
    setSelectedViewBill(bill);
    setViewBillModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        billId: selectedBill._id,
        amountPaid: Number(payData.amountPaid),
        paymentMode: payData.paymentMode,
        referenceNumber: payData.referenceNumber,
        notes: payData.notes
      };

      await api.post('/payments', payload);
      setPayModal(false);
      fetchBills();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to log payment transaction');
    }
  };

  const handleOpenReminderModal = async (bill) => {
    setReminderCustomer(bill.customer);
    try {
      setLoading(true);
      const res = await api.get(`/customers/${bill.customer._id}`);
      setOutstandingDues(res.data.outstanding);
      setReminderModal(true);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch outstanding dues for customer reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      setError('');
      const res = await api.post('/payments/reminder', {
        customerId: reminderCustomer._id,
        language: reminderLanguage,
        outstandingAmount: outstandingDues.toFixed(2)
      });
      alert(`Reminder dispatched!\n\nMessage Content:\n"${res.data.text}"`);
      setReminderModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to dispatch payment reminder alert');
    }
  };

  // Direct File Download Handler
  const handleDownloadPDF = async (bill) => {
    try {
      await downloadAuthenticatedFile(`/bills/${bill._id}/pdf`, `Invoice_${bill.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Invoice download failed:', err);
      setError('Failed to download the invoice PDF');
    }
  };

  const handlePrintPDF = async (id) => {
    try {
      await openAuthenticatedFile(`/bills/${id}/pdf`);
    } catch (err) {
      console.error('Invoice preview failed:', err);
      setError('Failed to open the invoice PDF');
    }
  };

  const handleShareWhatsAppWeb = (bill) => {
    const text = `Dear ${bill.customer?.name || 'Customer'},\nHere is your invoice ${bill.invoiceNumber} for Rs. ${bill.totalAmount.toFixed(2)}. Please contact the pharmacy for a copy of the tax invoice.`;
    const formattedMobile = (bill.customer?.mobile || '').replace(/\D/g, '');
    const url = `https://wa.me/${formattedMobile.startsWith('91') ? '' : '91'}${formattedMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Invoices & Retail Bill Memos</h2>
      </div>

      {/* Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>Total Invoiced Sales</span>
          <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>Rs. {stats.totalInvoiced.toFixed(2)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>From {filteredBills.length} invoices</span>
        </div>

        <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>Payment Collected</span>
          <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--success, #198754)' }}>Rs. {stats.totalPaid.toFixed(2)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>Received from sales</span>
        </div>

        <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>Pending Outstanding</span>
          <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--warning, #D97706)' }}>Rs. {stats.totalPending.toFixed(2)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>Remaining balance</span>
        </div>
      </div>

      {/* Responsive Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: '#fff', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 180px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Payment Status</label>
          <select 
            value={selectedPaymentStatus} 
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Payments</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Fully Paid</option>
          </select>
        </div>

        {branches.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 180px' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Date Range</label>
          <DateFilter
            value={dateFilterType}
            startDate={customStartDate}
            endDate={customEndDate}
            onChange={({ filterType, startDate, endDate }) => {
              setDateFilterType(filterType);
              setCustomStartDate(startDate);
              setCustomEndDate(endDate);
            }}
          />
        </div>
      </div>

      {/* Bills Data Grid Table */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading bills...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light, #D9E1E7)' }}>
                <th style={{ padding: '12px 14px', width: '36px' }}>
                  <input 
                    type="checkbox"
                    checked={filteredBills.length > 0 && selectedIds.length === filteredBills.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '12px 10px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '40px' }}>#</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '140px' }}>INVOICE ID</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '140px' }}>CUSTOMER</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '110px' }}>DATE</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '110px' }}>GRAND TOTAL</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '100px' }}>PAID</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '100px' }}>PENDING</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', width: '80px' }}>STATUS</th>
                <th style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length > 0 ? (
                filteredBills.map((b, idx) => {
                  const paymentDetails = getBillPaymentDetails(b);
                  const isPaid = b.status === 'Paid';
                  return (
                    <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(b._id)}
                          onChange={() => handleSelectRow(b._id)}
                        />
                      </td>
                      <td style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <button 
                          onClick={() => handleOpenViewBillModal(b)}
                          style={{ background: 'transparent', border: 'none', fontWeight: '700', color: 'var(--primary, #087E8B)', fontSize: '12px', cursor: 'pointer', fontFamily: 'monospace', textDecoration: 'underline' }}
                        >
                          {b.invoiceNumber}
                        </button>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '600', fontSize: '13px' }}>{b.customer?.name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary, #1F2937)', fontWeight: '700', fontSize: '13px' }}>
                        Rs. {b.totalAmount.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--success, #198754)', fontWeight: '600', fontSize: '13px' }}>
                        Rs. {paymentDetails.paid.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', fontSize: '13px', color: paymentDetails.pending > 0 ? '#dc2626' : '#16a34a' }}>
                        Rs. {paymentDetails.pending.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '3px 10px', 
                          borderRadius: '20px', 
                          fontWeight: 'bold',
                          display: 'inline-block',
                          background: isPaid ? '#dcfce7' : '#fef2f2',
                          color: isPaid ? '#15803d' : '#dc2626',
                          border: `1px solid ${isPaid ? '#bbf7d0' : '#fecaca'}`
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                          <button 
                            onClick={() => handleOpenViewBillModal(b)}
                            title="View Memo Bill UI"
                            style={{ padding: '5px 9px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}
                          >
                            👁️ View
                          </button>
                          <button 
                            onClick={() => handleDownloadPDF(b)}
                            title="Direct File Download"
                            style={{ padding: '5px 9px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}
                          >
                            📥 Download
                          </button>
                          <button 
                            onClick={() => handlePrintPDF(b._id)}
                            title="Print / View PDF"
                            style={{ padding: '5px 9px', background: 'var(--border-subtle, #F1F5F9)', color: 'var(--text-primary, #1F2937)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}
                          >
                            🖨️ PDF
                          </button>
                          <button 
                            disabled
                            title="Customer messaging disabled for pilot (PRODUCTION_DATA_SCOPE.md)"
                            style={{ padding: '5px 9px', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'not-allowed', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', opacity: 0.7 }}
                          >
                            💬 Reminder (Coming Soon)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Responsive Physical Retail Memo Bill Book UI Structure Modal */}
      {viewBillModal && selectedViewBill && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15,23,42,0.75)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 1000, padding: '12px', overflowY: 'auto' 
        }}>
          <div style={{ 
            background: '#fff', 
            borderRadius: '16px', 
            padding: '20px', 
            maxWidth: '520px', 
            width: '100%', 
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', 
            position: 'relative' 
          }}>
            
            {/* Responsive Modal Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#b91c1c' }}>🔴 Retail Memo Bill Book</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => handleDownloadPDF(selectedViewBill)} 
                  className="btn btn-success" 
                  style={{ background: 'var(--primary, #087E8B)', borderColor: 'var(--primary, #087E8B)', padding: '6px 12px', fontSize: '12px' }}
                >
                  📥 Download PDF
                </button>
                <button 
                  onClick={() => handlePrintPDF(selectedViewBill._id)} 
                  className="btn btn-primary" 
                  style={{ background: 'var(--secondary, #17324D)', borderColor: 'var(--secondary, #17324D)', padding: '6px 12px', fontSize: '12px' }}
                >
                  🖨️ Open / Print
                </button>
                <button 
                  onClick={() => setViewBillModal(false)} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Responsive Physical Retail Memo Bill Book UI Structure Container */}
            <div style={{ 
              border: '3px double #b91c1c', 
              borderRadius: '12px', 
              padding: '12px', 
              background: '#ffffff', 
              color: '#b91c1c',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {/* Top Contact Numbers */}
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', marginBottom: '4px' }}>
                Mob. {settings?.contact || '9876543210, 7020317605'}
              </div>

              {/* Solid Red Header Title Banner Box */}
              <div style={{ background: '#b91c1c', color: '#ffffff', textAlign: 'center', padding: '7px 4px', borderRadius: '4px', fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {settings?.companyName || 'NARESH ENTERPRISES'}
              </div>

              {/* Sub-header Address & Category */}
              <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: '700', color: '#b91c1c', marginBottom: '2px' }}>
                Add. {settings?.address || 'Office H. No. 34/B, Beside Govt. ITI, NANDED'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#b91c1c' }}>
                PHARMACEUTICALS & MEDICAL DISTRIBUTORS
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #b91c1c', margin: '6px 0' }} />

              {/* Serial No. & Date Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '12px', padding: '0 2px' }}>
                <span>No. <span style={{ color: '#111827', fontFamily: 'monospace' }}>{selectedViewBill.invoiceNumber}</span></span>
                <span>Date: <span style={{ color: '#111827' }}>{new Date(selectedViewBill.createdAt).toLocaleDateString('en-IN')}</span></span>
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #b91c1c', margin: '6px 0' }} />

              {/* Customer Shri Line */}
              <div style={{ fontWeight: '800', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span>Shri.</span>
                <span style={{ color: '#111827', flex: 1, borderBottom: '1px dotted #b91c1c', fontWeight: '700' }}>
                  {selectedViewBill.customer?.name || 'Walk-in Customer'}
                </span>
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #b91c1c', margin: '6px 0 0 0' }} />

              {/* Itemized Grid Table */}
              <div style={{ border: '2px solid #b91c1c', marginTop: '6px', overflowX: 'auto' }}>
                {/* Header Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 45px 55px 75px', background: '#fff5f5', borderBottom: '2px solid #b91c1c', fontWeight: '800', fontSize: '10.5px', textAlign: 'center' }}>
                  <div style={{ borderRight: '1.5px solid #b91c1c', padding: '3px 2px' }}>No.</div>
                  <div style={{ borderRight: '1.5px solid #b91c1c', padding: '3px 4px', textAlign: 'left' }}>Particulars</div>
                  <div style={{ borderRight: '1.5px solid #b91c1c', padding: '3px 2px' }}>Qty.</div>
                  <div style={{ borderRight: '1.5px solid #b91c1c', padding: '3px 2px' }}>Rate</div>
                  <div>
                    <div style={{ borderBottom: '1px solid #b91c1c', padding: '1px' }}>Amount</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '9.5px' }}>
                      <span style={{ borderRight: '1px solid #b91c1c' }}>Rs.</span>
                      <span>Ps.</span>
                    </div>
                  </div>
                </div>

                {/* 15 Pre-numbered Rows Grid Body */}
                <div style={{ minHeight: '300px' }}>
                  {Array.from({ length: 15 }).map((_, idx) => {
                    const item = selectedViewBill.items && selectedViewBill.items[idx];
                    const lineTotal = item ? item.price * item.quantity : null;
                    const parts = lineTotal !== null ? lineTotal.toFixed(2).split('.') : ['', ''];

                    return (
                      <div key={idx} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '28px 1fr 45px 55px 75px', 
                        borderBottom: idx < 14 ? '1px solid #fee2e2' : 'none', 
                        fontSize: '10px',
                        alignItems: 'center',
                        minHeight: '20px'
                      }}>
                        <div style={{ borderRight: '1.5px solid #b91c1c', textAlign: 'center', fontWeight: '800' }}>{idx + 1}.</div>
                        <div style={{ borderRight: '1.5px solid #b91c1c', padding: '2px 4px', color: '#111827', fontWeight: '600', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {item?.product?.name || ''}
                        </div>
                        <div style={{ borderRight: '1.5px solid #b91c1c', textAlign: 'center', color: '#111827' }}>
                          {item ? `${item.quantity}` : ''}
                        </div>
                        <div style={{ borderRight: '1.5px solid #b91c1c', textAlign: 'right', paddingRight: '3px', color: '#111827' }}>
                          {item ? item.price.toFixed(2) : ''}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', color: '#111827', fontWeight: '700' }}>
                          <span style={{ borderRight: '1px solid #b91c1c', paddingRight: '2px', textAlign: 'right' }}>{parts[0]}</span>
                          <span>{parts[1]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TOTAL Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 75px', borderTop: '2px solid #b91c1c', background: '#fff5f5', fontWeight: '900', fontSize: '12px' }}>
                  <div style={{ borderRight: '1.5px solid #b91c1c', textAlign: 'right', padding: '5px 8px' }}>TOTAL</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', padding: '5px 0' }}>
                    <span style={{ borderRight: '1px solid #b91c1c', textAlign: 'right', paddingRight: '2px' }}>
                      {selectedViewBill.totalAmount.toFixed(2).split('.')[0]}
                    </span>
                    <span>{selectedViewBill.totalAmount.toFixed(2).split('.')[1]}</span>
                  </div>
                </div>
              </div>

              {/* Bank Payment Details & Payment QR Code Footer Box */}
              <div style={{ border: '1.5px solid #b91c1c', borderRadius: '6px', padding: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '9.5px', color: '#111827', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: '800', color: '#b91c1c', marginBottom: '2px' }}>BANK PAYMENT DETAILS:</div>
                  <div>Bank: {settings?.bankDetails?.bankName || 'State Bank of India'}</div>
                  <div>A/C No: {settings?.bankDetails?.accountNo || '12345678901'}</div>
                  <div>IFSC Code: {settings?.bankDetails?.ifscCode || 'SBIN0001234'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src="/assets/payment-qr.png" 
                    alt="UPI Payment QR Code" 
                    style={{ width: '76px', height: '76px', borderRadius: '4px', border: '1px solid #b91c1c', objectFit: 'contain', background: '#fff', imageRendering: 'crisp-edges' }}
                  />
                  <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#b91c1c', marginTop: '1px' }}>Scan to Pay</div>
                  <div style={{ fontSize: '7.5px', color: '#4b5563' }}>tammewark@okicici</div>
                </div>
              </div>

              {/* Footer Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', padding: '0 2px', fontStyle: 'italic', fontWeight: '800', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '12px' }}>Thank You...</span>
                <span style={{ fontSize: '11px' }}>For: {settings?.companyName?.toUpperCase() || 'NARESH ENTERPRISES'}</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Log Payment Collection</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Record payment against Invoice {selectedBill?.invoiceNumber}. Total Amount due: Rs. {selectedBill?.totalAmount.toFixed(2)}</p>
            
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Notes</label>
                <input 
                  type="text"
                  value={payData.notes}
                  onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
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

      {/* WhatsApp Localized Reminder Modal */}
      {reminderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Send Dues Reminder</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Send outstanding balance reminder to <strong>{reminderCustomer?.name}</strong> (Mobile: {reminderCustomer?.mobile}).</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Select Message Language</label>
                <select 
                  value={reminderLanguage}
                  onChange={(e) => setReminderLanguage(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="english">English Template</option>
                  <option value="marathi">Marathi Template (मराठी)</option>
                </select>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#334155', minHeight: '80px', lineHeight: '1.6' }}>
                {reminderLanguage === 'english' ? (
                  <span>Dear {reminderCustomer?.name}, your outstanding payment of Rs. {outstandingDues.toFixed(2)} is pending. Please pay at the earliest. Thank you, {settings?.companyName || 'NARESH ENTERPRISES'}.</span>
                ) : (
                  <span>प्रिय {reminderCustomer?.name}, तुमचे थकीत बिल {outstandingDues.toFixed(2)} रुपये प्रलंबित आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद, {settings?.companyName || 'NARESH ENTERPRISES'}.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setReminderModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendReminder}
                  style={{ flex: 1, padding: '10px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  💬 Send WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
