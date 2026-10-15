import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  DollarSign,
  Package,
  Truck,
  AlertCircle,
  BarChart3,
  Repeat,
  BookOpen,
  RefreshCw,
  Download,
  Calendar,
  User
} from 'lucide-react';
import DateFilter from '../components/DateFilter.jsx';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Master Lists
  const [customers, setCustomers] = useState([]);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Report Data
  const [reportData, setReportData] = useState([]);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);

  useEffect(() => {
    // Fetch dropdown data
    api.get('/customers').then(res => setCustomers(Array.isArray(res.data) ? res.data : [])).catch(console.error);
  }, []);

  const runReport = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      let params = [];

      if (activeTab === 'sales') {
        endpoint = '/reports/sales';
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
      } else if (activeTab === 'stock') {
        endpoint = '/reports/stock';
      } else if (activeTab === 'delivery') {
        endpoint = '/reports/delivery';
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
      } else if (activeTab === 'outstanding') {
        endpoint = '/reports/outstanding';
      } else if (activeTab === 'orders_analysis' || activeTab === 'upcoming_loops') {
        endpoint = '/dashboard/stats';
      } else if (activeTab === 'ledger') {
        if (!selectedCustomerId) {
          setError('Please select a customer for the Ledger Statement');
          setLoading(false);
          return;
        }
        endpoint = `/reports/ledger?customerId=${selectedCustomerId}`;
      }

      const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await api.get(`${endpoint}${queryStr}`);
      
      if (activeTab === 'ledger') {
        setReportData(Array.isArray(res.data?.ledger) ? res.data.ledger : []);
        setLedgerCustomer(res.data?.customer || null);
      } else {
        setReportData(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate report: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setReportData([]);
    setError('');
    if (activeTab === 'sales' || activeTab === 'stock' || activeTab === 'delivery' || activeTab === 'outstanding' || activeTab === 'orders_analysis' || activeTab === 'upcoming_loops') {
      runReport();
    }
  }, [activeTab]);

  const handleExportCSV = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) return;

    let headers = [];
    let rows = [];
    let filename = `${activeTab}_report_${Date.now()}.csv`;

    if (activeTab === 'sales') {
      headers = ['Invoice Number', 'Customer', 'Date', 'Subtotal', 'CGST/SGST Total', 'Grand Total', 'Status'];
      rows = reportData.map(b => [
        b.invoiceNumber || '',
        b.customer?.name || '',
        b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '',
        (b.subtotal || 0).toFixed(2),
        ((b.cgstTotal || 0) + (b.sgstTotal || 0)).toFixed(2),
        (b.totalAmount || 0).toFixed(2),
        b.status || ''
      ]);
    } else if (activeTab === 'stock') {
      headers = ['Product Name', 'Category', 'Unit', 'Price', 'Current Stock', 'Low Stock Threshold', 'Linked Vendor'];
      rows = reportData.map(p => [
        p.name || '',
        p.category || '',
        p.unit || '',
        (p.price || 0).toFixed(2),
        p.currentStock ?? 0,
        p.lowStockThreshold ?? 0,
        p.linkedVendor?.name || ''
      ]);
    } else if (activeTab === 'delivery') {
      headers = ['Order Ref', 'Customer', 'Delivery Date', 'Driver/Staff', 'Total Amount', 'Status'];
      rows = reportData.map(o => [
        o._id ? `ORD-${o._id.substring(Math.max(0, o._id.length - 6)).toUpperCase()}` : '',
        o.customer?.name || '',
        o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '',
        o.assignedStaff?.name || 'Unassigned',
        (o.totalAmount || 0).toFixed(2),
        o.status || ''
      ]);
    } else if (activeTab === 'outstanding') {
      headers = ['Customer Name', 'Mobile', 'Total Invoiced', 'Total Paid', 'Outstanding Balance'];
      rows = reportData.map(o => [
        o.customer?.name || '',
        o.customer?.mobile || '',
        (o.totalSales || 0).toFixed(2),
        (o.totalPaid || 0).toFixed(2),
        (o.outstandingAmount || 0).toFixed(2)
      ]);
    } else if (activeTab === 'ledger') {
      headers = ['Date', 'Type', 'Reference/Ref ID', 'Debit (+Invoice)', 'Credit (-Paid)', 'Running Balance'];
      rows = reportData.map(l => [
        l.date ? new Date(l.date).toLocaleDateString() : '',
        l.type || '',
        l.ref || '',
        (l.debit || 0).toFixed(2),
        (l.credit || 0).toFixed(2),
        (l.runningBalance || 0).toFixed(2)
      ]);
      filename = `ledger_${(ledgerCustomer?.name || 'customer').replace(/\s+/g, '_')}_${Date.now()}.csv`;
    }

    // Build CSV Content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell || ''}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light, #D9E1E7)', flexWrap: 'wrap', gap: '4px' }}>
        <button 
          onClick={() => setActiveTab('sales')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'sales' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'sales' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <DollarSign size={16} /> Sales Report
        </button>
        <button 
          onClick={() => setActiveTab('stock')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'stock' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'stock' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <Package size={16} /> Stock Report
        </button>
        <button 
          onClick={() => setActiveTab('delivery')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'delivery' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'delivery' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <Truck size={16} /> Deliveries Report
        </button>
        <button 
          onClick={() => setActiveTab('outstanding')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'outstanding' ? '3px solid var(--danger, #DC3545)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'outstanding' ? 'var(--danger, #DC3545)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <AlertCircle size={16} color={activeTab === 'outstanding' ? 'var(--danger, #DC3545)' : 'var(--text-secondary, #64748B)'} /> Outstanding Dues
        </button>
        <button 
          onClick={() => setActiveTab('orders_analysis')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'orders_analysis' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'orders_analysis' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <BarChart3 size={16} /> Orders Analysis
        </button>
        <button 
          onClick={() => setActiveTab('upcoming_loops')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'upcoming_loops' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'upcoming_loops' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <Repeat size={16} /> Upcoming Loops
        </button>
        <button 
          onClick={() => setActiveTab('ledger')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'ledger' ? '3px solid var(--primary, #087E8B)' : '3px solid transparent', fontWeight: '700', fontSize: '13px', color: activeTab === 'ledger' ? 'var(--primary, #087E8B)' : 'var(--text-secondary, #64748B)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <BookOpen size={16} /> Customer Ledger Statement
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'var(--danger-light, #F8D7DA)', border: '1px solid var(--danger, #DC3545)', color: 'var(--danger, #DC3545)', borderRadius: 'var(--radius-md, 8px)' }}>
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '16px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {(activeTab === 'sales' || activeTab === 'delivery') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary, #64748B)' }}>Date Range</label>
            <DateFilter
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
              }}
            />
          </div>
        )}

        {activeTab === 'ledger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary, #64748B)' }}>Select Customer Profile</label>
            <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', width: '220px' }}>
              <option value="">Choose Customer</option>
              {customers.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', marginLeft: 'auto' }}>
          <button 
            onClick={runReport}
            className="btn btn-primary"
          >
            <RefreshCw size={14} /> Run Query
          </button>
          {Array.isArray(reportData) && reportData.length > 0 && (
            <button 
              onClick={handleExportCSV}
              className="btn btn-success"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Report Output Area */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>Calculating report records...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)' }}>
          
          {activeTab === 'sales' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Sr. No.</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Invoice Ref</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Customer</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Date</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Subtotal</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>GST (CGST/SGST)</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Grand Total</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(reportData) && reportData.length > 0 ? (
                  reportData.map((b, idx) => (
                    <tr key={b._id || idx} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{b.invoiceNumber || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{b.customer?.name || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>Rs. {(b.subtotal || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Rs. {((b.cgstTotal || 0) + (b.sgstTotal || 0)).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>Rs. {(b.totalAmount || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span className={`badge ${b.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}>
                          {b.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No transactions recorded.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'stock' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Sr. No.</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Product Item</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Category</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Price</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Current Stock</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Low Stock Alert Min</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Supplier Vendor</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(reportData) && reportData.length > 0 ? (
                  reportData.map((p, idx) => (
                    <tr key={p._id || idx} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)', background: (p.currentStock ?? 0) <= (p.lowStockThreshold ?? 0) ? 'var(--warning-light, #FEF3C7)' : 'transparent' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{p.name || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{p.category || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>Rs. {(p.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: (p.currentStock ?? 0) <= (p.lowStockThreshold ?? 0) ? 'var(--danger, #DC3545)' : 'var(--text-primary, #1F2937)' }}>
                        {p.currentStock ?? 0} {p.unit || ''}
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{p.lowStockThreshold ?? 0} {p.unit || ''}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{p.linkedVendor?.name || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No products seeded.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'delivery' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Sr. No.</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Order Ref</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Customer</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Delivery Date</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Assigned Driver</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Total Value</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(reportData) && reportData.length > 0 ? (
                  reportData.map((o, idx) => (
                    <tr key={o._id || idx} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{o._id ? `ORD-${o._id.substring(Math.max(0, o._id.length - 6)).toUpperCase()}` : 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{o.customer?.name || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{o.assignedStaff?.name || 'Unassigned'}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>Rs. {(o.totalAmount || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span className={`badge ${o.status === 'Delivered' ? 'badge-success' : 'badge-info'}`}>
                          {o.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No matching deliveries runs.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'outstanding' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Sr. No.</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Customer Name</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Mobile</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Total Invoiced Billing</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Total Payments Received</th>
                  <th style={{ padding: '12px 20px', color: 'var(--danger, #DC3545)', fontWeight: '700' }}>Outstanding Dues</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(reportData) && reportData.length > 0 ? (
                  reportData.map((item, idx) => (
                    <tr key={item.customer?._id || idx} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{item.customer?.name || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{item.customer?.mobile || 'N/A'}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>Rs. {(item.totalSales || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>Rs. {(item.totalPaid || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--danger, #DC3545)' }}>Rs. {(item.outstandingAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No pending balances. Perfect collections status!</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'ledger' && (
            <div>
              {ledgerCustomer && (
                <div style={{ background: 'var(--bg-main, #F6F8FA)', padding: '15px 20px', borderBottom: '1px solid var(--border-light, #D9E1E7)', fontSize: '13px', color: 'var(--text-secondary, #64748B)' }}>
                  Statement Account Ledger for: <strong>{ledgerCustomer.name}</strong> | Address: {ledgerCustomer.address}
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Sr. No.</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Date</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Transaction Type</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Reference Ref ID</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Debit (+Invoice)</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>Credit (-Payment)</th>
                    <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(reportData) && reportData.length > 0 ? (
                    reportData.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                        <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: '700' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '12px 20px', fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{item.type || 'N/A'}</td>
                        <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{item.ref || 'N/A'}</td>
                        <td style={{ padding: '12px 20px', color: item.debit > 0 ? 'var(--danger, #DC3545)' : 'var(--text-secondary, #64748B)' }}>
                          {item.debit > 0 ? `Rs. ${item.debit.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: '12px 20px', color: item.credit > 0 ? 'var(--success, #198754)' : 'var(--text-secondary, #64748B)' }}>
                          {item.credit > 0 ? `Rs. ${item.credit.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: '12px 20px', fontWeight: '700', color: item.runningBalance > 0 ? 'var(--danger, #DC3545)' : 'var(--success, #198754)' }}>
                          Rs. {(item.runningBalance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>Select a customer and click "Run Query" to generate ledger.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders_analysis' && reportData && (
            <div style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary, #1F2937)', marginBottom: '15px' }}>Recent Order Updates</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {reportData.recentOrders && Array.isArray(reportData.recentOrders) && reportData.recentOrders.length > 0 ? (
                  reportData.recentOrders.map((order, idx) => (
                    <div key={order._id || idx} style={{ padding: '15px', background: 'var(--bg-card, #FFFFFF)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary, #1F2937)' }}>{order.ref || 'N/A'}</span>
                        <span className={`badge ${order.status === 'Delivered' ? 'badge-success' : 'badge-info'}`}>
                          {order.status || 'Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', marginBottom: '5px' }}>Customer: {order.customerName || 'N/A'}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', marginBottom: '5px' }}>Amount: Rs. {(order.totalAmount || 0).toFixed(2)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}>Updated: {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'N/A'}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '14px' }}>No recent orders found.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upcoming_loops' && reportData && (
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '25px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--danger, #DC3545)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="var(--danger, #DC3545)" /> Action Required: Due in 1 Day (Create New Order)
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                  {Array.isArray(reportData.activeLoops) && reportData.activeLoops.filter(loop => !loop.recurringProcessed && loop.status === 'Delivered' && (new Date(loop.nextRun) - new Date()) / (1000 * 60 * 60 * 24) <= 1).length > 0 ? (
                    reportData.activeLoops.filter(loop => !loop.recurringProcessed && loop.status === 'Delivered' && (new Date(loop.nextRun) - new Date()) / (1000 * 60 * 60 * 24) <= 1).map((loop, idx) => (
                      <div key={loop.orderId || idx} style={{ padding: '15px', background: 'var(--danger-light, #F8D7DA)', border: '1px solid var(--danger, #DC3545)', borderRadius: 'var(--radius-md, 8px)' }}>
                        <div style={{ fontWeight: '700', color: 'var(--danger, #DC3545)', marginBottom: '5px' }}>{loop.customerName || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--danger, #DC3545)', marginBottom: '5px' }}>Mobile: {loop.customerMobile || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--danger, #DC3545)', marginBottom: '5px' }}>Due Date: {loop.nextRun ? new Date(loop.nextRun).toLocaleDateString() : 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--danger, #DC3545)', fontWeight: '700' }}>Amount: Rs. {(loop.totalAmount || 0).toFixed(2)}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '14px' }}>No orders due within 1 day.</div>
                  )}
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--warning, #D97706)', marginBottom: '10px' }}>⏳ Upcoming Renewals: Due in 2-5 Days</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                  {Array.isArray(reportData.activeLoops) && reportData.activeLoops.filter(loop => {
                    if (loop.recurringProcessed || loop.status !== 'Delivered') return false;
                    const diffDays = (new Date(loop.nextRun) - new Date()) / (1000 * 60 * 60 * 24);
                    return diffDays > 1 && diffDays <= 5;
                  }).length > 0 ? (
                    reportData.activeLoops.filter(loop => {
                      if (loop.recurringProcessed || loop.status !== 'Delivered') return false;
                      const diffDays = (new Date(loop.nextRun) - new Date()) / (1000 * 60 * 60 * 24);
                      return diffDays > 1 && diffDays <= 5;
                    }).map((loop, idx) => (
                      <div key={loop.orderId || idx} style={{ padding: '15px', background: 'var(--warning-light, #FEF3C7)', border: '1px solid var(--warning-border, #FDE68A)', borderRadius: 'var(--radius-md, 8px)' }}>
                        <div style={{ fontWeight: '700', color: 'var(--warning, #D97706)', marginBottom: '5px' }}>{loop.customerName || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--warning, #D97706)', marginBottom: '5px' }}>Mobile: {loop.customerMobile || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--warning, #D97706)', marginBottom: '5px' }}>Due Date: {loop.nextRun ? new Date(loop.nextRun).toLocaleDateString() : 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--warning, #D97706)', fontWeight: '700' }}>Amount: Rs. {(loop.totalAmount || 0).toFixed(2)}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '14px' }}>No orders due in 2-5 days.</div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
