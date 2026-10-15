import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import Toast from '../components/Toast.jsx';
import { downloadAuthenticatedFile, openAuthenticatedFile } from '../utils/authenticatedDownload.js';

export default function Dashboard({ role, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [loopMessage, setLoopMessage] = useState('');
  const [loopProcessing, setLoopProcessing] = useState(false);
  const [loopFilterMode, setLoopFilterMode] = useState('before_5_days');
  const [customDaysWindow, setCustomDaysWindow] = useState(5);

  // Products & Stock Alerts State for Dashboard
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orderForm, setOrderForm] = useState({ quantity: '', expectedDeliveryDate: '' });

  // Quick Stock In State (Single Item & Multiple Items)
  const [quickSingleProduct, setQuickSingleProduct] = useState('');
  const [quickSingleQty, setQuickSingleQty] = useState('');
  const [quickSingleReason, setQuickSingleReason] = useState('purchase');
  const [quickStockSuccess, setQuickStockSuccess] = useState('');
  const [quickStockLoading, setQuickStockLoading] = useState(false);

  const [showBulkStockModal, setShowBulkStockModal] = useState(false);
  const [bulkStockRows, setBulkStockRows] = useState([{ productId: '', quantityToAdd: '' }]);
  const [bulkReason, setBulkReason] = useState('purchase');

  const handleSingleQuickStockIn = async (e) => {
    e.preventDefault();
    if (!quickSingleProduct || !quickSingleQty || Number(quickSingleQty) <= 0) return;
    try {
      setQuickStockLoading(true);
      await api.put(`/products/${quickSingleProduct}/adjust`, {
        quantity: Number(quickSingleQty),
        type: 'in',
        reason: quickSingleReason
      });
      const prod = products.find(p => p._id === quickSingleProduct);
      setQuickStockSuccess(`Successfully added +${quickSingleQty} stock to ${prod?.name || 'product'}!`);
      setQuickSingleProduct('');
      setQuickSingleQty('');
      setTimeout(() => setQuickStockSuccess(''), 4000);
      fetchProductsAndVendors();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to update stock');
    } finally {
      setQuickStockLoading(false);
    }
  };

  const handleBulkQuickStockInSubmit = async (e) => {
    e.preventDefault();
    const validItems = bulkStockRows.filter(r => r.productId && r.quantityToAdd && Number(r.quantityToAdd) > 0);
    if (validItems.length === 0) {
      alert('Please select at least one product and enter a valid stock quantity.');
      return;
    }
    try {
      setQuickStockLoading(true);
      const res = await api.post('/products/quick-stock-in', {
        items: validItems,
        reason: bulkReason
      });
      setQuickStockSuccess(`✅ ${res.data.message}`);
      setShowBulkStockModal(false);
      setBulkStockRows([{ productId: '', quantityToAdd: '' }]);
      setTimeout(() => setQuickStockSuccess(''), 5000);
      fetchProductsAndVendors();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit bulk stock in');
    } finally {
      setQuickStockLoading(false);
    }
  };

  const handleAddBulkRow = () => {
    setBulkStockRows([...bulkStockRows, { productId: '', quantityToAdd: '' }]);
  };

  const handleRemoveBulkRow = (index) => {
    if (bulkStockRows.length === 1) return;
    setBulkStockRows(bulkStockRows.filter((_, i) => i !== index));
  };

  // Quick Express Issue State (Counter Sale / POS)
  const [issueCustomerName, setIssueCustomerName] = useState('');
  const [issueCustomerMobile, setIssueCustomerMobile] = useState('');
  const [issueCustomerNameError, setIssueCustomerNameError] = useState('');
  const [issueCustomerMobileError, setIssueCustomerMobileError] = useState('');
  const [issueSingleProduct, setIssueSingleProduct] = useState('');
  const [issueSingleQty, setIssueSingleQty] = useState('1');
  const [issueIsGst, setIssueIsGst] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const handleCustomerNameInputChange = (rawVal) => {
    let clean = rawVal.replace(/[^a-zA-Z\s.'&-]/g, '');
    clean = clean.replace(/\s{2,}/g, ' ');
    setIssueCustomerName(clean);
    setIssueCustomerNameError('');
  };

  const handleCustomerMobileInputChange = (rawVal) => {
    let clean = rawVal.replace(/\D/g, '').slice(0, 10);
    setIssueCustomerMobile(clean);
    if (!clean) {
      setIssueCustomerMobileError('');
    } else if (clean.length < 10) {
      setIssueCustomerMobileError('Enter a valid 10-digit mobile number.');
    } else {
      setIssueCustomerMobileError('');
    }
  };

  const [showMultiIssueModal, setShowMultiIssueModal] = useState(false);
  const [multiIssueRows, setMultiIssueRows] = useState([{ productId: '', quantity: '1' }]);

  // Generated Receipt Modal State
  const [generatedBillModal, setGeneratedBillModal] = useState(null);
  const [settings, setSettings] = useState(null);

  const [alertSettings, setAlertSettings] = useState(() => {
    const saved = localStorage.getItem('stock_alert_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      autoShowPopup: true,
      displayTimeSeconds: 10,
      popupFrequency: 'every_visit',
      globalLowThreshold: 10
    };
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(10);
  const [timerPaused, setTimerPaused] = useState(false);
  const [tempSettings, setTempSettings] = useState(alertSettings);
  const [alertPopupTab, setAlertPopupTab] = useState('low');
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const [orderingProduct, setOrderingProduct] = useState(null);

  const lowStockProducts = products.filter(p => p.currentStock <= (p.lowStockThreshold || alertSettings.globalLowThreshold));
  const outOfStockProducts = products.filter(p => p.currentStock === 0);

  const fetchProductsAndVendors = async () => {
    try {
      const [prodRes, venRes] = await Promise.all([
        api.get('/products'),
        api.get('/vendors')
      ]);
      setProducts(prodRes.data);
      setVendors(venRes.data);
    } catch (err) {
      console.error('Failed to fetch products for stock alerts on dashboard:', err);
    }
  };

  const handleProcessLoops = async () => {
    try {
      setLoopProcessing(true);
      setLoopMessage('Processing order loops...');
      const res = await api.post('/orders/process-recurring');
      setLoopMessage(res.data.message);
      setTimeout(() => setLoopMessage(''), 5000);
      fetchStats();
    } catch (err) {
      console.error(err);
      setLoopMessage('Failed to process loops');
      setTimeout(() => setLoopMessage(''), 5000);
    } finally {
      setLoopProcessing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard metrics');
    }
  };

  // Quick Express Issue Handlers (defined here so fetchStats & fetchProductsAndVendors are in scope)
  const handleSingleQuickIssue = async (e) => {
    e.preventDefault();
    if (issueCustomerMobile && issueCustomerMobile.length > 0 && issueCustomerMobile.length < 10) {
      setIssueCustomerMobileError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!issueSingleProduct || !issueSingleQty || Number(issueSingleQty) <= 0) return;
    try {
      setIssueLoading(true);
      const res = await api.post('/products/quick-issue', {
        customerName: issueCustomerName,
        customerMobile: issueCustomerMobile,
        items: [{ productId: issueSingleProduct, quantity: Number(issueSingleQty) }],
        isGstApplicable: issueIsGst
      });
      setGeneratedBillModal(res.data.bill);
      setIssueCustomerName('');
      setIssueCustomerMobile('');
      setIssueCustomerNameError('');
      setIssueCustomerMobileError('');
      setIssueSingleProduct('');
      setIssueSingleQty('1');
      fetchProductsAndVendors();
      fetchStats();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to issue item';
      setToast({ type: 'error', message: msg });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleMultiQuickIssueSubmit = async (e) => {
    e.preventDefault();
    if (issueCustomerMobile && issueCustomerMobile.length > 0 && issueCustomerMobile.length < 10) {
      setIssueCustomerMobileError('Enter a valid 10-digit mobile number.');
      return;
    }
    const validItems = multiIssueRows.filter(r => r.productId && r.quantity && Number(r.quantity) > 0);
    if (validItems.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one product and enter a valid quantity.' });
      return;
    }
    try {
      setIssueLoading(true);
      const res = await api.post('/products/quick-issue', {
        customerName: issueCustomerName,
        customerMobile: issueCustomerMobile,
        items: validItems.map(r => ({ productId: r.productId, quantity: Number(r.quantity) })),
        isGstApplicable: issueIsGst
      });
      setShowMultiIssueModal(false);
      setGeneratedBillModal(res.data.bill);
      setIssueCustomerName('');
      setIssueCustomerMobile('');
      setIssueCustomerNameError('');
      setIssueCustomerMobileError('');
      setMultiIssueRows([{ productId: '', quantity: '1' }]);
      fetchProductsAndVendors();
      fetchStats();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to complete quick counter sale';
      setToast({ type: 'error', message: msg });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleAddMultiIssueRow = () => {
    setMultiIssueRows([...multiIssueRows, { productId: '', quantity: '1' }]);
  };

  const handleRemoveMultiIssueRow = (index) => {
    if (multiIssueRows.length === 1) return;
    setMultiIssueRows(multiIssueRows.filter((_, i) => i !== index));
  };

  const handleShareWhatsAppWeb = (bill) => {
    if (!bill) return;
    const text = `Dear ${bill.customer?.name || 'Customer'},\nThank you for your purchase at ${settings?.companyName || 'Naresh Enterprises'}.\nHere is your receipt Invoice No. ${bill.invoiceNumber} for Rs. ${bill.totalAmount.toFixed(2)}.`;
    const mobile = (bill.customer?.mobile || '').replace(/\D/g, '');
    const url = `https://wa.me/${mobile.startsWith('91') ? '' : '91'}${mobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleGeneratedBillPdf = async (bill, download) => {
    if (!bill) return;
    try {
      if (download) {
        await downloadAuthenticatedFile(`/bills/${bill._id}/pdf`, `Invoice_${bill.invoiceNumber}.pdf`);
      } else {
        await openAuthenticatedFile(`/bills/${bill._id}/pdf`);
      }
    } catch (err) {
      console.error('Generated invoice PDF failed:', err);
      setError('Failed to open the generated invoice PDF');
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Load settings from backend
    api.get('/settings').then(res => setSettings(res.data)).catch(err => console.error(err));

    // Initial fetch
    setLoading(true);
    Promise.all([fetchStats(), fetchNotifications()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProductsAndVendors();
  }, []);


  const handleCloseAlert = () => {
    setShowAlertPopup(false);
    setManuallyClosed(true);
    sessionStorage.setItem('last_stock_popup_time_dash', Date.now().toString());
  };

  // Auto-Show Stock Alert Popup Effect disabled per user request

  // Countdown Timer for Popup Display
  useEffect(() => {
    let timer = null;
    if (showAlertPopup && alertSettings.displayTimeSeconds > 0 && !timerPaused) {
      timer = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            handleCloseAlert();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showAlertPopup, alertSettings.displayTimeSeconds, timerPaused]);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setAlertSettings(tempSettings);
    localStorage.setItem('stock_alert_settings', JSON.stringify(tempSettings));
    setShowSettingsModal(false);
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases', {
        supplierId: orderingProduct.linkedVendor?._id || orderingProduct.linkedVendor,
        items: [{
          product: orderingProduct._id?._id || orderingProduct._id,
          quantity: Number(orderForm.quantity),
          costPrice: orderingProduct.price || 0
        }],
        expectedDeliveryDate: orderForm.expectedDeliveryDate,
        branchId: orderingProduct.branch?._id || orderingProduct.branch
      });
      alert('Purchase Order dispatched successfully! ✅');
      setOrderingProduct(null);
      fetchProductsAndVendors();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert('Failed to dispatch order');
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      // Update local state
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !stats) {
    return <div style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>Loading dashboard details...</div>;
  }

  // Prepping Chart Data
  const chartData = stats?.customerDues?.slice(0, 5).map(item => ({
    name: item.name.substring(0, 12),
    outstanding: item.outstanding
  })) || [];

  const pieData = stats?.orderStatusCounts ? [
    { name: 'Pending', value: stats.orderStatusCounts.Pending || 0, color: '#f59e0b' },
    { name: 'Assigned', value: stats.orderStatusCounts.Assigned || 0, color: 'var(--primary, #087E8B)' },
    { name: 'Packed', value: stats.orderStatusCounts.Packed || 0, color: '#8b5cf6' },
    { name: 'Out for Delivery', value: stats.orderStatusCounts['Out for Delivery'] || 0, color: '#06b6d4' },
    { name: 'Delivered', value: stats.orderStatusCounts.Delivered || 0, color: '#10b981' },
    { name: 'Cancelled', value: stats.orderStatusCounts.Cancelled || 0, color: '#ef4444' }
  ].filter(d => d.value > 0) : [];

  const upcomingLoops = stats?.activeLoops?.filter(loop => {
    if (loop.recurringProcessed || loop.status === 'Cancelled') return false;
    const now = new Date();
    const nextRunDate = new Date(loop.nextRun);
    const diffTime = nextRunDate - now;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (loopFilterMode === 'all') {
      return true;
    }
    if (loopFilterMode === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return nextRunDate >= todayStart && nextRunDate <= todayEnd;
    }
    if (loopFilterMode === 'tomorrow') {
      const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
      return nextRunDate >= tomorrowStart && nextRunDate <= tomorrowEnd;
    }
    if (loopFilterMode === 'this_week') {
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
      return nextRunDate <= weekEnd;
    }
    if (loopFilterMode === 'this_month') {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return nextRunDate <= monthEnd;
    }
    if (loopFilterMode === 'custom') {
      const maxDays = Number(customDaysWindow) || 5;
      return diffDays <= maxDays;
    }
    // Default 'before_5_days'
    return diffDays <= 5;
  }).sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun)) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* ⚡ Quick Express Issue / Counter Sale Widget (Single & Multiple Items) */}
      <div style={{ 
        background: '#fff', 
        borderRadius: '12px', 
        padding: '18px 20px', 
        color: '#1e293b',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        border: '1px solid #D9E1E7'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#087E8B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛍️ Quick Express Sale / Issue Item (Counter Sale)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              Issue 1 tablet or items immediately. Customer details are optional (leave blank for Walk-in). Stock is auto-deducted &amp; receipt generated.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setShowMultiIssueModal(true)}
            style={{ 
              padding: '9px 16px', 
              background: '#087E8B', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: '700', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🛒 POS Multi-Item Quick Issue (+ Multiple Items)
          </button>
        </div>

        {/* Single Item Express Issue Bar */}
        <form onSubmit={handleSingleQuickIssue} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column' }}>
            <input 
              type="text"
              placeholder="Customer Name (Optional)"
              value={issueCustomerName}
              onChange={(e) => handleCustomerNameInputChange(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${issueCustomerNameError ? '#ef4444' : '#e2e8f0'}`, background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            />
            {issueCustomerNameError && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{issueCustomerNameError}</span>}
          </div>

          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
            <input 
              type="text"
              maxLength={10}
              placeholder="Mobile (Optional)"
              value={issueCustomerMobile}
              onChange={(e) => handleCustomerMobileInputChange(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${issueCustomerMobileError ? '#ef4444' : '#e2e8f0'}`, background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            />
            {issueCustomerMobileError && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{issueCustomerMobileError}</span>}
          </div>

          <select 
            value={issueSingleProduct}
            onChange={(e) => setIssueSingleProduct(e.target.value)}
            style={{ flex: '2 1 200px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            required
          >
            <option value="">-- Choose Product to Issue --</option>
            {products.map(p => (
              <option key={p._id} value={p._id}>{p.name} (Stock: {p.currentStock} {p.unit || 'pcs'} | Rs. {p.price.toFixed(2)})</option>
            ))}
          </select>

          <input 
            type="number"
            min="1"
            placeholder="Qty"
            value={issueSingleQty}
            onChange={(e) => setIssueSingleQty(e.target.value)}
            style={{ width: '75px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            required
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox"
              checked={issueIsGst}
              onChange={(e) => setIssueIsGst(e.target.checked)}
            />
            GST (18%)
          </label>

          <button 
            type="submit"
            disabled={issueLoading}
            style={{ padding: '9px 20px', background: '#087E8B', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {issueLoading ? 'Processing...' : '⚡ Issue Item & Receipt'}
          </button>
        </form>
      </div>

      {/* ⚡ Quick Stock In Widget (Single Item & Multiple Items) */}
      <div style={{ 
        background: '#fff', 
        borderRadius: '12px', 
        padding: '18px 20px', 
        color: '#1e293b',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        border: '1px solid #D9E1E7'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#087E8B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Quick Stock In (Fast Inventory Addition)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              Add new stock incoming for a single item or multiple items in seconds.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setShowBulkStockModal(true)}
            style={{ 
              padding: '9px 16px', 
              background: '#087E8B', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: '700', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📦 Bulk Multi-Item Stock In (+ Multiple Products)
          </button>
        </div>

        {quickStockSuccess && (
          <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>
            {quickStockSuccess}
          </div>
        )}

        {/* Single Item Quick Stock Entry Form Bar */}
        <form onSubmit={handleSingleQuickStockIn} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={quickSingleProduct}
            onChange={(e) => setQuickSingleProduct(e.target.value)}
            style={{ flex: '2 1 200px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            required
          >
            <option value="">-- Select Product for Quick Stock Addition --</option>
            {products.map(p => (
              <option key={p._id} value={p._id}>{p.name} (Current Stock: {p.currentStock} {p.unit || 'pcs'})</option>
            ))}
          </select>

          <input 
            type="number"
            min="1"
            placeholder="+ Qty to Add"
            value={quickSingleQty}
            onChange={(e) => setQuickSingleQty(e.target.value)}
            style={{ flex: '1 1 110px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
            required
          />

          <select 
            value={quickSingleReason}
            onChange={(e) => setQuickSingleReason(e.target.value)}
            style={{ flex: '1 1 140px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '13px', outline: 'none' }}
          >
            <option value="purchase">Purchase Arrival</option>
            <option value="adjustment">Stock Addition</option>
            <option value="return">Customer Return</option>
          </select>

          <button 
            type="submit"
            disabled={quickStockLoading}
            style={{ padding: '9px 20px', background: '#087E8B', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {quickStockLoading ? 'Updating...' : '⚡ Add Stock Now'}
          </button>
        </form>
      </div>



      {/* Top Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div 
          onClick={() => onNavigate && onNavigate('bills')}
          style={{ background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#087E8B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sales</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#17324D', marginTop: '10px' }}>Rs. {stats?.totalSales?.toFixed(2) || '0.00'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
            <span>Today: <strong>Rs. {stats?.todaySales?.toFixed(2) || '0.00'}</strong></span>
            <span>This Month: <strong>Rs. {stats?.thisMonthSales?.toFixed(2) || '0.00'}</strong></span>
          </div>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('customers')}
          style={{ background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#DC3545', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Amount</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#17324D', marginTop: '10px' }}>Rs. {stats?.totalOutstanding?.toFixed(2) || '0.00'}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>Outstanding credit balance from invoices</div>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('orders')}
          style={{ background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#198754', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Deliveries</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#17324D', marginTop: '10px' }}>{stats?.todayDeliveries || 0}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
            <span>Tomorrow: <strong>{stats?.tomorrowDeliveries}</strong></span>
            <span>Total Pending: <strong>{stats?.pendingDeliveries}</strong></span>
          </div>
        </div>

        <div 
          onClick={() => {
            if (lowStockProducts.length > 0) {
              setRemainingSeconds(alertSettings.displayTimeSeconds > 0 ? alertSettings.displayTimeSeconds : 10);
              setTimerPaused(false);
              setManuallyClosed(false);
              setShowAlertPopup(true);
            } else if (onNavigate) {
              onNavigate('products');
            }
          }}
          style={{ background: '#FFFFFF', border: stats?.lowStockCount > 0 ? '1px solid #fef3c7' : '1px solid #D9E1E7', borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: stats?.lowStockCount > 0 ? '#D97706' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Stock Items</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#17324D', marginTop: '10px' }}>{stats?.lowStockCount || 0}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
            {stats?.lowStockCount > 0 ? '⚠️ Immediate restock required' : '✅ Stock levels are normal'}
          </div>
        </div>
      </div>

      {/* Order Loops Banner */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: upcomingLoops.length > 0 ? '20px' : '0' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔄 Order Loops (Recurring Deliveries)
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Review due cycles and generate recurring orders manually. No background scheduler runs on the web service.
            </p>
            <p style={{ fontSize: '12px', color: '#475569', margin: '8px 0 0' }}>
              Last successful review: <strong>{stats?.recurringOrderJob?.lastSuccessfulRunAt ? new Date(stats.recurringOrderJob.lastSuccessfulRunAt).toLocaleString() : 'Not run yet'}</strong>
              {stats?.recurringOrderJob?.lastSuccessfulRunAt && ` — ${stats.recurringOrderJob.lastResult?.created || 0} created, ${stats.recurringOrderJob.lastResult?.skipped || 0} skipped`}
            </p>
            {loopMessage && <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>{loopMessage}</span>}
          </div>
          <button 
            onClick={handleProcessLoops}
            disabled={loopProcessing}
            style={{ padding: '10px 20px', background: loopProcessing ? 'var(--text-muted, #94A3B8)' : 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: loopProcessing ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s', boxShadow: '0 4px 6px -1px rgba(8, 126, 139, 0.2)' }}
            onMouseOver={(e) => e.target.style.background = 'var(--primary-hover, #066a75)'}
            onMouseOut={(e) => e.target.style.background = 'var(--primary, #087E8B)'}
          >
            {loopProcessing ? 'Processing...' : 'Process Due Loops'}
          </button>
        </div>
        
        <div 
          style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', overflow: 'hidden' }}
        >
          <div style={{ padding: '12px 16px', background: '#fef3c7', fontSize: '13px', fontWeight: 'bold', color: '#b45309', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⏳ Upcoming Order Loops Alert ({upcomingLoops.length})
            </span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e' }}>Filter Alert Period:</label>
              <select 
                value={loopFilterMode}
                onChange={(e) => setLoopFilterMode(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fcd34d', background: '#fff', fontSize: '12px', color: '#78350f', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                <option value="all">All Recurring Loops (All Time)</option>
                <option value="before_5_days">Within 5 Days (Default Alert)</option>
                <option value="today">Due Today (Day wise)</option>
                <option value="tomorrow">Due Tomorrow</option>
                <option value="this_week">Due This Week (7 Days)</option>
                <option value="this_month">Due This Month (Month wise)</option>
                <option value="custom">Custom Days Threshold</option>
              </select>

              {loopFilterMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input 
                    type="number"
                    min="1"
                    value={customDaysWindow}
                    onChange={(e) => setCustomDaysWindow(e.target.value)}
                    style={{ width: '55px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '12px', outline: 'none' }}
                  />
                  <span style={{ fontSize: '11px', color: '#92400e' }}>days</span>
                </div>
              )}
            </div>
          </div>
          {upcomingLoops.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                {upcomingLoops.map(loop => {
                  const nextRunDate = new Date(loop.nextRun);
                  const lastRunDate = loop.lastRun ? new Date(loop.lastRun) : null;
                  return (
                    <tr key={loop.orderId} style={{ borderBottom: '1px solid #fef3c7' }}>
                      <td style={{ padding: '10px 16px', color: '#92400e', fontWeight: '600', fontSize: '13px' }}>
                        <span onClick={() => onNavigate && onNavigate('orders')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                          {loop.customerName}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#92400e', fontSize: '13px' }}>{loop.customerMobile}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: '#fde68a', color: '#78350f', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                          🔄 Every {loop.recurringIntervalDays || 30} Days
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#64748b', fontSize: '12px' }}>
                        Prev Delivery: <strong>{lastRunDate ? lastRunDate.toLocaleDateString() : 'N/A'}</strong>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#b45309', fontSize: '13px', fontWeight: '600' }}>
                        Next Due: <strong>{nextRunDate.toLocaleDateString()}</strong>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#92400e', fontWeight: 'bold', fontSize: '13px', textAlign: 'right' }}>
                        Rs. {loop.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '16px', color: '#d97706', fontSize: '13px', textAlign: 'center' }}>
              No recurring order loops found matching the selected timeframe filter.
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Orders Analysis and Recent Updates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* Order Status Breakdown */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>Orders Analysis</h2>
          {pieData.length > 0 ? (
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No orders found.
            </div>
          )}
        </div>

        {/* Recent Order Updates Feed */}
        <div 
          onClick={() => onNavigate && onNavigate('orders')}
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>Recent Order Updates</h2>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '220px', paddingRight: '5px' }}>
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.recentOrders.map(order => (
                  <div key={order._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>{order.ref}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{order.customerName}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>Rs. {order.totalAmount.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px',
                        background: order.status === 'Delivered' ? '#dcfce7' : order.status === 'Cancelled' ? '#fee2e2' : '#e0f2fe',
                        color: order.status === 'Delivered' ? '#166534' : order.status === 'Cancelled' ? '#991b1b' : '#0369a1',
                        fontWeight: '600'
                      }}>
                        {order.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Charts and Low Stock Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* Outstanding Dues Chart */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>Top Outstanding Dues by Customer</h2>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => [`Rs. ${value.toFixed(2)}`, 'Outstanding']} />
                  <Bar dataKey="outstanding" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#ef4444" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No outstanding dues to display
            </div>
          )}
        </div>

        {/* Low Stock Warning List */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Stock Alerts</span>
            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '10px' }}>Critical</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            {stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 ? (
              stats.lowStockAlerts.map(p => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#92400e' }}>{p.name}</strong>
                    <div style={{ fontSize: '11px', color: '#b45309' }}>Threshold level: {p.threshold}</div>
                  </div>
                  <div style={{ background: '#f59e0b', color: '#fff', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                    {p.currentStock} left
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '13px' }}>
                ✅ All product stocks are in healthy state.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Live Alerts/Notifications & Recent Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* Live Alerts Notification Panel */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            🔔 Live Delivery & Stock Notifications
            <span style={{ animation: 'pulse 2s infinite', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {notifications.length > 0 ? (
              notifications.map(n => (
                <div key={n._id} style={{ display: 'flex', gap: '12px', padding: '12px', background: n.read ? '#f8fafc' : '#f0f9ff', border: n.read ? '1px solid #e2e8f0' : '1px solid #bae6fd', borderRadius: '8px', opacity: n.read ? 0.75 : 1 }}>
                  <div style={{ fontSize: '20px' }}>
                    {n.type === 'delivery' && '🚚'}
                    {n.type === 'low_stock' && '⚠️'}
                    {n.type === 'delivery_reminder' && '📅'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{n.title}</strong>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{new Date(n.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{n.message}</p>
                    
                    {!n.read && (
                      <button 
                        onClick={() => handleMarkAsRead(n._id)}
                        style={{ marginTop: '8px', padding: '2px 8px', fontSize: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm, 4px)', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '13px' }}>
                No recent notifications.
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions Ledger */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>Recent Payments Received</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map(p => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>{p.customerName}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Mode: <span style={{ textTransform: 'uppercase' }}>{p.mode}</span> | Date: {new Date(p.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#166534' }}>+ Rs. {p.amount.toFixed(2)}</div>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{p.ref || 'Ref: N/A'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '13px' }}>
                No payments logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Interactive Stock Alert Popup Modal with Admin Timer on Dashboard */}
      {showAlertPopup && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}
        >
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '650px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #fca5a5' }}>
            
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)', color: '#fff', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  ⚠️ Low Stock Alert Center
                </h3>
                <p style={{ fontSize: '13px', color: '#fca5a5', margin: '4px 0 0 0' }}>
                  {lowStockProducts.length} product(s) require immediate reordering
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {alertSettings.displayTimeSeconds > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{timerPaused ? `⏸️ Paused (${remainingSeconds}s)` : `⏳ Auto-close in ${remainingSeconds}s`}</span>
                    <button
                      type="button"
                      onClick={() => setTimerPaused(!timerPaused)}
                      style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {timerPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                  </div>
                )}
                <button 
                  onClick={handleCloseAlert}
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            {alertSettings.displayTimeSeconds > 0 && (
              <div style={{ height: '4px', background: '#fee2e2', width: '100%' }}>
                <div style={{ height: '100%', background: timerPaused ? '#f59e0b' : '#ef4444', width: `${(remainingSeconds / alertSettings.displayTimeSeconds) * 100}%`, transition: 'width 1s linear' }} />
              </div>
            )}

            {/* Content Tabs */}
            <div style={{ padding: '16px 24px 0 24px', display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', background: '#fff9f9' }}>
              <button 
                onClick={() => setAlertPopupTab('low')}
                style={{ padding: '8px 16px', border: 'none', borderBottom: alertPopupTab === 'low' ? '3px solid #dc2626' : '3px solid transparent', background: 'transparent', fontWeight: 'bold', color: alertPopupTab === 'low' ? '#b91c1c' : '#64748b', cursor: 'pointer', fontSize: '13px' }}
              >
                Low Stock ({lowStockProducts.length})
              </button>
              <button 
                onClick={() => setAlertPopupTab('out')}
                style={{ padding: '8px 16px', border: 'none', borderBottom: alertPopupTab === 'out' ? '3px solid #dc2626' : '3px solid transparent', background: 'transparent', fontWeight: 'bold', color: alertPopupTab === 'out' ? '#b91c1c' : '#64748b', cursor: 'pointer', fontSize: '13px' }}
              >
                Out of Stock ({outOfStockProducts.length})
              </button>
            </div>

            {/* Alert List Table */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '16px 24px' }}>
              {((alertPopupTab === 'low' ? lowStockProducts : outOfStockProducts).length === 0) ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#166534', fontWeight: 'bold', fontSize: '14px' }}>
                  ✅ No products currently in this category!
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #fee2e2', color: '#991b1b', textTransform: 'uppercase', fontSize: '11px' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Stock / Min</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(alertPopupTab === 'low' ? lowStockProducts : outOfStockProducts).map(prod => (
                      <tr key={prod._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{prod.name}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{prod.category}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: prod.currentStock === 0 ? '#fee2e2' : '#fef3c7', color: prod.currentStock === 0 ? '#991b1b' : '#92400e', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>
                            {prod.currentStock} / {prod.lowStockThreshold || alertSettings.globalLowThreshold} {prod.unit}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => {
                              handleCloseAlert();
                              setOrderingProduct(prod);
                              setOrderForm({ quantity: Math.max(20, (prod.lowStockThreshold || 10) * 2), expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] });
                            }}
                            style={{ padding: '6px 12px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                          >
                            ⚡ Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  handleCloseAlert();
                  setTempSettings(alertSettings);
                  setShowSettingsModal(true);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary, #087E8B)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ⚙️ Adjust Popup Duration ({alertSettings.displayTimeSeconds}s)
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleCloseAlert}
                  style={{ padding: '8px 16px', background: '#cbd5e1', color: '#1e293b', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  Close Alert
                </button>
                <button 
                  onClick={() => {
                    handleCloseAlert();
                    if (onNavigate) onNavigate('products');
                  }}
                  style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  📦 View Products
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Admin Stock Alert & Popup Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Stock Alert & Popup Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Popup Duration (Seconds) */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  ⏱️ Popup Auto-Close Timer (Seconds set by Admin)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number"
                    min="0"
                    max="300"
                    value={tempSettings.displayTimeSeconds}
                    onChange={(e) => setTempSettings({ ...tempSettings, displayTimeSeconds: Number(e.target.value) })}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold' }}
                    required
                  />
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>seconds</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[5, 10, 15, 30, 60, 0].map(sec => (
                    <button
                      type="button"
                      key={sec}
                      onClick={() => setTempSettings({ ...tempSettings, displayTimeSeconds: sec })}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: tempSettings.displayTimeSeconds === sec ? 'var(--primary, #087E8B)' : '#f8fafc', color: tempSettings.displayTimeSeconds === sec ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      {sec === 0 ? 'Never Auto-Close (0s)' : `${sec}s Preset`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-Show Popup Toggle */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox"
                  id="auto-show-popup-dash-check"
                  checked={tempSettings.autoShowPopup}
                  onChange={(e) => setTempSettings({ ...tempSettings, autoShowPopup: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="auto-show-popup-dash-check" style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}>
                  Automatically open Alert Popup when low-stock items exist
                </label>
              </div>

              {/* Popup Frequency */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  🔄 Popup Display Frequency
                </label>
                <select 
                  value={tempSettings.popupFrequency}
                  onChange={(e) => setTempSettings({ ...tempSettings, popupFrequency: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="1min">Every 1 Minute</option>
                  <option value="2min">Every 2 Minutes</option>
                  <option value="3min">Every 3 Minutes</option>
                  <option value="5min">Every 5 Minutes</option>
                  <option value="10min">Every 10 Minutes</option>
                  <option value="15min">Every 15 Minutes</option>
                  <option value="30min">Every 30 Minutes</option>
                  <option value="60min">Every 1 Hour (60 Mins)</option>
                  <option value="every_visit">Every Page Visit</option>
                  <option value="session">Once Per Session</option>
                </select>
              </div>

              {/* Global Default Low-Stock Threshold */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  📉 Default Low Stock Threshold (Units)
                </label>
                <input 
                  type="number"
                  min="1"
                  value={tempSettings.globalLowThreshold}
                  onChange={(e) => setTempSettings({ ...tempSettings, globalLowThreshold: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Applies as default low-stock threshold for products without custom min levels.</span>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Save Settings
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Quick Purchase Order Modal */}
      {orderingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '5px' }}>Quick Purchase Order</h3>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{orderingProduct.name}</div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Vendor:</strong> {vendors.find(v => v._id === (orderingProduct.linkedVendor?._id || orderingProduct.linkedVendor))?.name || 'Unknown'}</span>
                <span><strong>Price:</strong> Rs. {orderingProduct.price.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Current Stock:</strong> {orderingProduct.currentStock} {orderingProduct.unit}</span>
                <span style={{ color: '#dc2626' }}><strong>Min Alert:</strong> {orderingProduct.lowStockThreshold} {orderingProduct.unit}</span>
              </div>
            </div>
            
            <form onSubmit={handleOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Quantity to Order*</label>
                  <input 
                    type="number"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                    min="1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Total Est. Value</label>
                  <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#0f172a' }}>
                    Rs. {(orderingProduct.price * (Number(orderForm.quantity) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Expected Delivery Date*</label>
                <input 
                  type="date"
                  value={orderForm.expectedDeliveryDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setOrderingProduct(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Dispatch Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Multi-Item Stock In Modal */}
      {showBulkStockModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>📦 Bulk Stock In (Multiple Items)</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Quickly add incoming stock quantities for multiple products simultaneously.</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowBulkStockModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleBulkQuickStockInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Stock Arrival Reason</label>
                <select 
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="purchase">Supplier Purchase Arrival</option>
                  <option value="adjustment">Bulk Manual Stock Addition</option>
                  <option value="return">Customer Return Batch</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Select Products & Quantities to Add:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bulkStockRows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: 'bold', color: '#64748b', fontSize: '12px', width: '20px' }}>{idx + 1}.</span>
                      <select 
                        value={row.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkStockRows(prev => prev.map((r, i) => i === idx ? { ...r, productId: val } : r));
                        }}
                        style={{ flex: 3, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                        required
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Current: {p.currentStock} {p.unit || 'pcs'})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        placeholder="+ Qty to Add"
                        value={row.quantityToAdd}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkStockRows(prev => prev.map((r, i) => i === idx ? { ...r, quantityToAdd: val } : r));
                        }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        required
                      />

                      <button 
                        type="button"
                        onClick={() => handleRemoveBulkRow(idx)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  onClick={handleAddBulkRow}
                  style={{ marginTop: '12px', padding: '7px 14px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  ➕ Add Another Product Line
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowBulkStockModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={quickStockLoading}
                  style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {quickStockLoading ? 'Saving Stock...' : '⚡ Confirm Bulk Stock In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS Multi-Item Quick Issue Modal */}
      {showMultiIssueModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>🛒 POS Multi-Item Quick Counter Sale</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Issue multiple products over the counter in a single quick sale.</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowMultiIssueModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleMultiQuickIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Customer Name (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Ramesh / Leave blank for Walk-in"
                    value={issueCustomerName}
                    onChange={(e) => handleCustomerNameInputChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${issueCustomerNameError ? '#ef4444' : '#cbd5e1'}`, fontSize: '13px' }}
                  />
                  {issueCustomerNameError && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>{issueCustomerNameError}</span>}
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Mobile Number (Optional)</label>
                  <input 
                    type="text"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={issueCustomerMobile}
                    onChange={(e) => handleCustomerMobileInputChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${issueCustomerMobileError ? '#ef4444' : '#cbd5e1'}`, fontSize: '13px' }}
                  />
                  {issueCustomerMobileError && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>{issueCustomerMobileError}</span>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Select Products & Quantities to Issue:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {multiIssueRows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: 'bold', color: '#64748b', fontSize: '12px', width: '20px' }}>{idx + 1}.</span>
                      <select 
                        value={row.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMultiIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, productId: val } : r));
                        }}
                        style={{ flex: 3, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                        required
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Stock: {p.currentStock} {p.unit || 'pcs'} | Rs. {p.price.toFixed(2)})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMultiIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: val } : r));
                        }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        required
                      />

                      <button 
                        type="button"
                        onClick={() => handleRemoveMultiIssueRow(idx)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  onClick={handleAddMultiIssueRow}
                  style={{ marginTop: '12px', padding: '7px 14px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  ➕ Add Another Product Line
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '600' }}>
                  <input 
                    type="checkbox"
                    checked={issueIsGst}
                    onChange={(e) => setIssueIsGst(e.target.checked)}
                  />
                  Apply GST Tax (18%) for this Counter Sale
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowMultiIssueModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={issueLoading}
                  style={{ flex: 1, padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {issueLoading ? 'Issuing Items...' : '⚡ Complete Sale & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Counter Sale Retail Receipt & WhatsApp Share Modal */}
      {generatedBillModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15,23,42,0.8)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 1100, padding: '12px', overflowY: 'auto' 
        }}>
          <div style={{ 
            background: '#fff', 
            borderRadius: '16px', 
            padding: '20px', 
            maxWidth: '520px', 
            width: '100%', 
            maxHeight: '94vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' 
          }}>
            
            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#b91c1c' }}>🎉 Item Issued &amp; Receipt Generated!</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => handleGeneratedBillPdf(generatedBillModal, true)}
                  style={{ background: 'var(--primary, #087E8B)', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  💾 Save PDF
                </button>
                <button 
                  onClick={() => handleGeneratedBillPdf(generatedBillModal, false)}
                  style={{ background: '#b91c1c', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🖨️ Open / Print
                </button>
                <button 
                  onClick={() => {
                    setGeneratedBillModal(null);
                    fetchStats();
                    fetchProductsAndVendors();
                  }} 
                  style={{ background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ✕ Done
                </button>
              </div>
            </div>

            {/* Exact Physical Memo Bill Book UI Structure */}
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
                Mob. {settings?.contact || '9822311640, 7020317605'}
              </div>

              {/* Solid Red Header Title Banner Box */}
              <div style={{ background: '#b91c1c', color: '#ffffff', textAlign: 'center', padding: '7px 4px', borderRadius: '4px', fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {settings?.companyName || 'NARESH ENTERPRISES'}
              </div>

              {/* Sub-header Address & Category */}
              <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: '700', color: '#b91c1c', marginBottom: '2px' }}>
                Add. {settings?.address || 'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#b91c1c' }}>
                PHARMACEUTICALS &amp; MEDICAL DISTRIBUTORS
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #b91c1c', margin: '6px 0' }} />

              {/* Serial No. & Date Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '12px', padding: '0 2px' }}>
                <span>No. <span style={{ color: '#111827', fontFamily: 'monospace' }}>{generatedBillModal.invoiceNumber}</span></span>
                <span>Date: <span style={{ color: '#111827' }}>{new Date(generatedBillModal.createdAt).toLocaleDateString('en-IN')}</span></span>
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #b91c1c', margin: '6px 0' }} />

              {/* Customer Shri Line */}
              <div style={{ fontWeight: '800', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span>Shri.</span>
                <span style={{ color: '#111827', flex: 1, borderBottom: '1px dotted #b91c1c', fontWeight: '700' }}>
                  {generatedBillModal.customer?.name || 'Walk-in Customer'}
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
                <div style={{ minHeight: '260px' }}>
                  {Array.from({ length: 15 }).map((_, idx) => {
                    const item = generatedBillModal.items && generatedBillModal.items[idx];
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
                      {generatedBillModal.totalAmount.toFixed(2).split('.')[0]}
                    </span>
                    <span>{generatedBillModal.totalAmount.toFixed(2).split('.')[1]}</span>
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

      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'success', message: '' })}
      />

    </div>
  );
}
