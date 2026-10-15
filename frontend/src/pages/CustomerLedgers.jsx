import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';

export default function CustomerLedgers({ onNavigate }) {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('pending_desc');

  // Selected Customer Ledger Modal state
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [activeTab, setActiveTab] = useState('statement'); // 'statement', 'orders', 'payments'

  // Payment Record Modal State
  const [paymentModalCustomer, setPaymentModalCustomer] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCategory, setPaymentCategory] = useState('Ledger Settlement');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Fetch Customer Ledgers Summary
  const fetchLedgers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/customer-ledgers/summary');
      setLedgers(res.data || []);
    } catch (err) {
      console.error('Failed to load customer ledgers:', err);
      setError(err.response?.data?.error || 'Failed to load customer ledgers summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  // Compute Overall Financial Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalCustomers = ledgers.length;
    let completedOrdersCount = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalPending = 0;

    ledgers.forEach(l => {
      completedOrdersCount += (l.completedOrdersCount || 0);
      totalBilled += (l.totalBilled || 0);
      totalPaid += (l.totalPaid || 0);
      totalPending += (l.pendingBalance || 0);
    });

    return {
      totalCustomers,
      completedOrdersCount,
      totalBilled,
      totalPaid,
      totalPending
    };
  }, [ledgers]);

  // Filter and Sort Ledgers List
  const filteredLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const cust = l.customer || {};
      const nameMatch = (cust.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (cust.mobile || '').includes(searchTerm) ||
                        (cust.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!nameMatch) return false;

      if (statusFilter && l.status !== statusFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'pending_desc') return (b.pendingBalance || 0) - (a.pendingBalance || 0);
      if (sortBy === 'pending_asc') return (a.pendingBalance || 0) - (b.pendingBalance || 0);
      if (sortBy === 'orders_desc') return (b.completedOrdersCount || 0) - (a.completedOrdersCount || 0);
      if (sortBy === 'name_asc') return (a.customer?.name || '').localeCompare(b.customer?.name || '');
      return 0;
    });
  }, [ledgers, searchTerm, statusFilter, sortBy]);

  // Handle Recording New Ledger Payment (Manual or Row-level)
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const targetCustId = paymentModalCustomer?.isManual ? selectedCustomerId : paymentModalCustomer?.customer?._id;

    if (!targetCustId) {
      alert('Please select a customer.');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setSubmittingPayment(true);
    try {
      await api.post('/customer-ledgers/record-payment', {
        customerId: targetCustId,
        amountPaid: Number(paymentAmount),
        paymentMode,
        date: paymentDate,
        category: paymentCategory,
        referenceNumber: paymentRef,
        notes: paymentNotes
      });

      alert(`Payment of Rs.${paymentAmount} successfully recorded!`);
      setPaymentModalCustomer(null);
      setSelectedCustomerId('');
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      fetchLedgers(); // Refresh data
    } catch (err) {
      console.error('Payment error:', err);
      alert(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Export Customer Ledgers to Excel
  const handleExportExcel = () => {
    const data = filteredLedgers.map((l, idx) => ({
      'Sr No': idx + 1,
      'Customer Name': l.customer?.name || 'N/A',
      'Mobile Number': l.customer?.mobile || 'N/A',
      'Completed Orders': l.completedOrdersCount || 0,
      'Total Billed (Rs)': l.totalBilled || 0,
      'Total Paid (Rs)': l.totalPaid || 0,
      'Pending Balance (Rs)': l.pendingBalance || 0,
      'Account Status': l.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer_Ledgers');
    XLSX.writeFile(workbook, `Customer_Ledgers_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ padding: '24px', background: '#F6F8FA', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Page Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#17324D', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📓 Customer Accounts & Ledger Management
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Manage completed order accounts, track customer payments received, and collect outstanding pending balances.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setPaymentModalCustomer({ isManual: true });
              setSelectedCustomerId('');
              setPaymentAmount('');
              setPaymentDate(new Date().toISOString().split('T')[0]);
              setPaymentCategory('Ledger Settlement');
              setPaymentRef('');
              setPaymentNotes('');
            }}
            style={{ padding: '8px 14px', background: '#087E8B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            💳 + Add Manual Payment
          </button>
          <button
            onClick={fetchLedgers}
            style={{ padding: '8px 14px', background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '8px', color: '#17324D', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleExportExcel}
            style={{ padding: '8px 14px', background: '#198754', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Financial Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17324D', marginTop: '6px' }}>{summaryMetrics.totalCustomers}</div>
          <div style={{ fontSize: '11px', color: '#087E8B', marginTop: '4px' }}>Active Account Directory</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>COMPLETED ORDERS</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#198754', marginTop: '6px' }}>{summaryMetrics.completedOrdersCount}</div>
          <div style={{ fontSize: '11px', color: '#198754', marginTop: '4px' }}>Delivered & Fulfilled</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>TOTAL SALES BILLED</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17324D', marginTop: '6px' }}>Rs. {summaryMetrics.totalBilled.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Gross Revenue Billed</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>TOTAL PAYMENTS RECEIVED</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#198754', marginTop: '6px' }}>Rs. {summaryMetrics.totalPaid.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#198754', marginTop: '4px' }}>Settled Collections</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#DC3545' }}>PENDING OUTSTANDING BALANCE</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#DC3545', marginTop: '6px' }}>Rs. {summaryMetrics.totalPending.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '4px' }}>To Be Collected</div>
        </div>

      </div>

      {/* Filter & Search Controls */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #D9E1E7', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '300px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94A3B8' }}>🔍</span>
              <input
                type="text"
                placeholder="Search customer name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
              />
            </div>

            {/* Payment Status Filter */}
            <div style={{ flex: '0 1 200px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', background: '#FFFFFF', fontSize: '13px', fontWeight: '500', color: '#1F2937', cursor: 'pointer' }}
              >
                <option value="">📋 All Payment Statuses</option>
                <option value="Pending Payment">⏳ Pending Payment</option>
                <option value="Partial Paid">🔶 Partial Paid</option>
                <option value="Settled">✅ Fully Settled</option>
              </select>
            </div>

            {/* Sort By */}
            <div style={{ flex: '0 1 250px' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', background: '#FFFFFF', fontSize: '13px', fontWeight: '500', color: '#1F2937', cursor: 'pointer' }}
              >
                <option value="pending_desc">⬇️ Highest Pending Balance</option>
                <option value="pending_asc">⬆️ Lowest Pending Balance</option>
                <option value="orders_desc">📦 Most Completed Orders</option>
                <option value="name_asc">🔤 Alphabetical Name</option>
              </select>
            </div>
          </div>

          <div style={{ 
            fontSize: '12px', color: '#17324D', fontWeight: '600', 
            background: '#E8F5F6', padding: '8px 14px', borderRadius: '20px', border: '1px solid #B2DFE3',
            whiteSpace: 'nowrap'
          }}>
            Showing <strong style={{ color: '#087E8B' }}>{filteredLedgers.length}</strong> of <strong>{ledgers.length}</strong> customer(s)
          </div>

        </div>
      </div>


      {/* Customer Ledgers Directory Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #D9E1E7' }}>
          Loading customer account ledgers...
        </div>
      ) : error ? (
        <div style={{ padding: '20px', color: '#DC3545', background: '#fee2e2', borderRadius: '10px', border: '1px solid #fecaca', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #D9E1E7', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E1E7' }}>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>SR. NO.</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>CUSTOMER NAME</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>CONTACT & ADDRESS</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>COMPLETED ORDERS</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>TOTAL BILLED</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>TOTAL PAID</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>PENDING BALANCE</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold' }}>ACCOUNT STATUS</th>
                <th style={{ padding: '14px 18px', fontSize: '12px', color: '#17324D', fontWeight: 'bold', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.length > 0 ? (
                filteredLedgers.map((item, idx) => {
                  const cust = item.customer || {};
                  return (
                    <tr 
                      key={cust._id || idx}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#E8F5F6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 18px', fontSize: '13px', color: '#64748B', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 'bold', color: '#17324D', fontSize: '14px' }}>{cust.name || 'Unnamed Customer'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{cust.email || 'No email registered'}</div>
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '12px', color: '#1F2937' }}>
                        <div>📱 {cust.mobile || 'N/A'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>📍 {cust.address || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ padding: '4px 10px', background: '#E8F5F6', color: '#087E8B', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          📦 {item.completedOrdersCount} Delivered
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 'bold', color: '#17324D' }}>
                        Rs. {(item.totalBilled || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 'bold', color: '#198754' }}>
                        Rs. {(item.totalPaid || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold', 
                          color: (item.pendingBalance || 0) > 0 ? '#DC3545' : '#198754',
                          background: (item.pendingBalance || 0) > 0 ? '#fee2e2' : '#dcfce7',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: (item.pendingBalance || 0) > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
                        }}>
                          Rs. {(item.pendingBalance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '12px', 
                          fontWeight: 'bold',
                          background: item.status === 'Settled' ? '#dcfce7' : item.status === 'Partial Paid' ? '#fef3c7' : '#fee2e2',
                          color: item.status === 'Settled' ? '#198754' : item.status === 'Partial Paid' ? '#D97706' : '#DC3545'
                        }}>
                          {item.status === 'Settled' ? '✓ Settled' : item.status === 'Partial Paid' ? '⏳ Partial' : '⚠️ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedLedger(item); setActiveTab('statement'); }}
                            style={{ padding: '6px 12px', background: '#E8F5F6', color: '#087E8B', border: '1px solid #B2DFE3', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          >
                            📜 Ledger
                          </button>
                          
                          {(item.pendingBalance || 0) > 0 && (
                            <button
                              onClick={() => { setPaymentModalCustomer(item); setPaymentAmount(item.pendingBalance); }}
                              style={{ padding: '6px 12px', background: '#198754', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              💳 Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    No customer accounts found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Full Ledger Statement Modal */}
      {selectedLedger && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23, 50, 77, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #D9E1E7', padding: '24px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #D9E1E7', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#17324D', margin: 0 }}>
                  📜 Customer Statement & Account Ledger
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                  {selectedLedger.customer?.name} (📱 {selectedLedger.customer?.mobile}) | 📍 {selectedLedger.customer?.address || 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedLedger(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {/* Customer Financial Overview Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #D9E1E7', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>TOTAL BILLED (COMPLETED)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#17324D', marginTop: '4px' }}>Rs. {(selectedLedger.totalBilled || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>TOTAL PAYMENTS RECEIVED</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#198754', marginTop: '4px' }}>Rs. {(selectedLedger.totalPaid || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#DC3545' }}>CURRENT PENDING BALANCE</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#DC3545', marginTop: '4px' }}>Rs. {(selectedLedger.pendingBalance || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #D9E1E7', marginBottom: '20px' }}>
              <button
                onClick={() => setActiveTab('statement')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'statement' ? '2px solid #087E8B' : 'none',
                  background: 'transparent',
                  color: activeTab === 'statement' ? '#087E8B' : '#64748B',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📜 Running Balance Statement
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'orders' ? '2px solid #087E8B' : 'none',
                  background: 'transparent',
                  color: activeTab === 'orders' ? '#087E8B' : '#64748B',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📦 Completed Orders ({selectedLedger.completedOrders?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'payments' ? '2px solid #087E8B' : 'none',
                  background: 'transparent',
                  color: activeTab === 'payments' ? '#087E8B' : '#64748B',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                💳 Payments Received ({selectedLedger.paymentsList?.length || 0})
              </button>
            </div>

            {/* TAB 1: Running Balance Statement Table */}
            {activeTab === 'statement' && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E1E7' }}>
                      <th style={{ padding: '10px', color: '#17324D', fontWeight: 'bold' }}>DATE</th>
                      <th style={{ padding: '10px', color: '#17324D', fontWeight: 'bold' }}>TYPE / REFERENCE</th>
                      <th style={{ padding: '10px', color: '#17324D', fontWeight: 'bold' }}>DEBIT (+BILLED)</th>
                      <th style={{ padding: '10px', color: '#17324D', fontWeight: 'bold' }}>CREDIT (-PAID)</th>
                      <th style={{ padding: '10px', color: '#17324D', fontWeight: 'bold' }}>RUNNING BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Generate unified ledger entries array
                      const entries = [];
                      (selectedLedger.completedOrders || []).forEach(o => {
                        entries.push({
                          date: o.deliveryDate || o.createdAt,
                          type: 'Completed Order Invoice',
                          ref: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
                          debit: o.totalAmount || 0,
                          credit: 0
                        });
                      });
                      (selectedLedger.paymentsList || []).forEach(p => {
                        entries.push({
                          date: p.date || p.createdAt,
                          type: `Payment Received (${p.paymentMode || 'Cash'})`,
                          ref: p.referenceNumber || 'Receipt',
                          debit: 0,
                          credit: p.amountPaid || 0
                        });
                      });

                      entries.sort((a, b) => new Date(a.date) - new Date(b.date));

                      let running = 0;
                      return entries.map((entry, eIdx) => {
                        running += (entry.debit - entry.credit);
                        return (
                          <tr key={eIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px', color: '#64748B' }}>{new Date(entry.date).toLocaleDateString()}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#17324D' }}>
                              {entry.type} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>({entry.ref})</span>
                            </td>
                            <td style={{ padding: '10px', color: entry.debit > 0 ? '#17324D' : '#94A3B8', fontWeight: 'bold' }}>
                              {entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '10px', color: entry.credit > 0 ? '#198754' : '#94A3B8', fontWeight: 'bold' }}>
                              {entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: running > 0 ? '#DC3545' : '#198754' }}>
                              Rs. {running.toLocaleString()}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Completed Orders Breakdown */}
            {activeTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(selectedLedger.completedOrders || []).map((ord, oIdx) => (
                  <div key={ord._id} style={{ border: '1px solid #D9E1E7', borderRadius: '8px', padding: '14px', background: '#FFFFFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#17324D' }}>
                        ORD-{ord._id.toString().substring(18).toUpperCase()}
                      </span>
                      <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#198754', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                        ✓ Delivered ({new Date(ord.deliveryDate || ord.createdAt).toLocaleDateString()})
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                      Items: {ord.items?.map(i => `${i.product?.name || 'Item'} (x${i.quantity})`).join(', ') || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', borderTop: '1px solid #D9E1E7', paddingTop: '8px' }}>
                      <span>Grand Total Amount:</span>
                      <span style={{ color: '#17324D' }}>Rs. {(ord.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: Payment History Log */}
            {activeTab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(selectedLedger.paymentsList || []).map((pay, pIdx) => (
                  <div key={pay._id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #D9E1E7' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#198754' }}>
                        💳 Payment Received: Rs. {(pay.amountPaid || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        Mode: {pay.paymentMode || 'Cash'} | Ref: {pay.referenceNumber || 'N/A'} | Date: {new Date(pay.date || pay.createdAt).toLocaleDateString()}
                      </div>
                      {pay.notes && <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>"{pay.notes}"</div>}
                    </div>
                    <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#198754', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                      Recorded
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Record Payment Direct Action Button inside Modal */}
            <div style={{ borderTop: '1px solid #D9E1E7', marginTop: '24px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => { setPaymentModalCustomer(selectedLedger); setPaymentAmount(selectedLedger.pendingBalance); }}
                style={{ padding: '8px 16px', background: '#087E8B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                💳 Record Payment Settlement
              </button>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 16px', background: '#FFFFFF', color: '#17324D', border: '1px solid #D9E1E7', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                🖨️ Print Statement
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Record Payment Form Modal */}
      {paymentModalCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23, 50, 77, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #D9E1E7', padding: '24px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #D9E1E7', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#17324D', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                💳 {paymentModalCustomer.isManual ? 'Add Manual Customer Payment' : 'Record Customer Payment'}
              </h3>
              <button onClick={() => setPaymentModalCustomer(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {paymentModalCustomer.isManual ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Select Customer Account*</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const target = ledgers.find(l => l.customer?._id === e.target.value);
                      if (target && target.pendingBalance > 0) {
                        setPaymentAmount(target.pendingBalance);
                      }
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937', fontWeight: '500' }}
                  >
                    <option value="">-- Select Customer --</option>
                    {ledgers.map(l => (
                      <option key={l.customer?._id} value={l.customer?._id}>
                        {l.customer?.name} (📱 {l.customer?.mobile || 'N/A'}) - Pending: Rs.{l.pendingBalance}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Customer Account</label>
                  <div style={{ padding: '10px', background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', color: '#17324D' }}>
                    {paymentModalCustomer.customer?.name} (📱 {paymentModalCustomer.customer?.mobile})
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Payment Date*</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Payment Category*</label>
                  <select
                    value={paymentCategory}
                    onChange={(e) => setPaymentCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
                  >
                    <option value="Ledger Settlement">Ledger Settlement</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Partial Settlement">Partial Settlement</option>
                    <option value="Security Deposit">Security Deposit</option>
                    <option value="Adjustment">Custom Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Amount Received (Rs.)*</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Enter amount in Rs."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '15px', fontWeight: 'bold', color: '#198754', background: '#FFFFFF' }}
                />
                {!paymentModalCustomer.isManual && (
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Current Pending Balance: Rs.{(paymentModalCustomer.pendingBalance || 0).toLocaleString()}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Payment Mode*</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR Code</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #981723 / Cheque #00123"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '4px' }}>Note / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Received cash payment at shop counter"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D9E1E7', outline: 'none', fontSize: '13px', background: '#FFFFFF', color: '#1F2937' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalCustomer(null)}
                  style={{ flex: 1, padding: '10px', background: '#FFFFFF', border: '1px solid #D9E1E7', color: '#17324D', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{ flex: 1, padding: '10px', background: '#087E8B', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {submittingPayment ? 'Recording...' : 'Submit Payment'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
