import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import DateFilter from '../components/DateFilter.jsx';
import Toast from '../components/Toast.jsx';

export function formatRecurrenceLabel(days) {
  const d = Number(days) || 30;
  if (d === 7) return 'Every Week';
  if (d === 14) return 'Every 2 Weeks';
  if (d === 15) return 'Every 15 Days';
  if (d === 30) return 'Every Month';
  if (d === 60) return 'Every 2 Months';
  if (d === 90) return 'Every Quarter';
  if (d === 365) return 'Every Year';
  return `Every ${d} Days`;
}

export default function Orders({ role, onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Customer Recurring Loop State
  const [activeLoops, setActiveLoops] = useState([]);
  const [loopFilterMode, setLoopFilterMode] = useState('before_5_days');
  const [customDaysWindow, setCustomDaysWindow] = useState(5);

  // Bulk and Filter States
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStaff, setBulkStaff] = useState('');

  // Order Details / Tracking View State
  const [trackingOrder, setTrackingOrder] = useState(null);

  // Form State for Add Order
  const [formMode, setFormMode] = useState(null); // 'add' | null
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderItems, setOrderItems] = useState([{ product: '', quantity: 1, price: 0 }]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(30);
  const [isGstApplicable, setIsGstApplicable] = useState(false);

  // Edit Order State
  const [editingOrder, setEditingOrder] = useState(null);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurringIntervalDays, setEditRecurringIntervalDays] = useState(30);
  const [editRemarks, setEditRemarks] = useState('');
  const [editIsGstApplicable, setEditIsGstApplicable] = useState(false);

  // Reassign Delivery Person State
  const [reassigningOrder, setReassigningOrder] = useState(null);
  const [reassignEmployeeId, setReassignEmployeeId] = useState('');

  const fetchData = async () => {
    try {
      const [ordRes, custRes, prodRes, branchRes, statsRes] = await Promise.all([
        api.get(`/orders${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/customers'),
        api.get('/products'),
        api.get('/branches'),
        api.get('/dashboard/stats')
      ]);
      setOrders(ordRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      setBranches(branchRes.data);
      if (statsRes.data?.activeLoops) {
        setActiveLoops(statsRes.data.activeLoops);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch orders or master directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const filteredLoopAlerts = activeLoops.filter(loop => {
    if (loop.status === 'Cancelled') return false;

    if (selectedStaff) {
      const loopStaffUserId = loop.assignedStaff?._id || loop.assignedStaff;
      const matchedEmp = staffList.find(st => st._id === selectedStaff || st.user?._id === selectedStaff);
      const targetUserId = matchedEmp?.user?._id || selectedStaff;
      if (loopStaffUserId !== targetUserId && loop.assignedStaff?._id !== targetUserId) return false;
    }

    const now = new Date();
    const triggerDate = new Date(loop.nextRun);
    const diffDays = Math.ceil((triggerDate - now) / (1000 * 60 * 60 * 24));

    if (loopFilterMode === 'today') {
      return triggerDate.toDateString() === now.toDateString() || diffDays <= 0;
    } else if (loopFilterMode === 'before_5_days') {
      return diffDays <= 5;
    } else if (loopFilterMode === 'before_7_days') {
      return diffDays <= 7;
    } else if (loopFilterMode === 'before_15_days') {
      return diffDays <= 15;
    } else if (loopFilterMode === 'before_30_days') {
      return diffDays <= 30;
    } else if (loopFilterMode === 'monthwise') {
      return triggerDate.getMonth() === now.getMonth() && triggerDate.getFullYear() === now.getFullYear();
    } else if (loopFilterMode === 'custom') {
      return diffDays <= Number(customDaysWindow);
    } else if (loopFilterMode === 'all') {
      return true;
    }
    return diffDays <= 5;
  });

  const handleTriggerLoopOrder = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/trigger-recurring`);
      alert(res.data.message || 'Next recurring order generated successfully! ✅');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to trigger recurring order');
    }
  };

  // Leaflet initialization hook for trackingOrder modal location map
  useEffect(() => {
    if (trackingOrder && trackingOrder.latitude && trackingOrder.longitude) {
      // Dynamic load Leaflet CSS and JS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        try {
          const L = window.L;
          const container = document.getElementById('map-container');
          if (container) {
            container.innerHTML = "<div id='map-element' style='height: 180px; border-radius: 8px; z-index: 1;'></div>";
            const map = L.map('map-element').setView([trackingOrder.latitude, trackingOrder.longitude], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            L.marker([trackingOrder.latitude, trackingOrder.longitude]).addTo(map)
              .bindPopup(`Delivery Coordinates: ${trackingOrder.latitude.toFixed(4)}, ${trackingOrder.longitude.toFixed(4)}`)
              .openPopup();
          }
        } catch (err) {
          console.error('Leaflet map rendering failed:', err);
        }
      };
      document.body.appendChild(script);

      return () => {
        document.head.removeChild(link);
        document.body.removeChild(script);
      };
    }
  }, [trackingOrder]);

  const handleOpenAdd = () => {
    setSelectedCustomerId('');
    setDeliveryDate('');
    setOrderItems([{ product: '', quantity: 1, price: 0 }]);
    setIsRecurring(false);
    setRecurringIntervalDays(30);
    setFormMode('add');
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...orderItems];
    updated[index].product = prodId;
    updated[index].price = selectedProd ? selectedProd.price : 0;
    setOrderItems(updated);
  };

  const handleItemQtyChange = (index, qty) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, Number(qty));
    setOrderItems(updated);
  };

  const handleAddItemRow = () => {
    setOrderItems([...orderItems, { product: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }
    const invalidItem = orderItems.find(it => !it.product || !it.quantity || Number(it.quantity) <= 0);
    if (invalidItem) {
      setError('Please select a product and enter a valid positive quantity for all items.');
      return;
    }
    try {
      const payload = {
        customer: selectedCustomerId,
        deliveryDate,
        items: orderItems.map(it => ({ product: it.product, quantity: it.quantity })),
        isRecurring,
        recurringIntervalDays,
        isGstApplicable
      };

      await api.post('/orders', payload);
      setFormMode(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit order');
    }
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (o) => {
    setEditingOrder(o);
    setEditCustomerId(o.customer?._id || o.customer || '');
    setEditDeliveryDate(o.deliveryDate ? o.deliveryDate.substring(0, 10) : '');
    setEditIsRecurring(o.isRecurring || false);
    setEditRecurringIntervalDays(o.recurringIntervalDays || 30);
    setEditRemarks(o.remarks || '');
    setEditIsGstApplicable(o.isGstApplicable || false);
    setEditOrderItems(o.items.map(it => ({
      product: it.product?._id || it.product,
      quantity: it.quantity,
      price: it.price
    })));
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        customerId: editCustomerId,
        deliveryDate: editDeliveryDate,
        isRecurring: editIsRecurring,
        recurringIntervalDays: editRecurringIntervalDays,
        remarks: editRemarks,
        isGstApplicable: editIsGstApplicable,
        items: editOrderItems.map(it => ({ productId: it.product, quantity: it.quantity, price: it.price }))
      };
      await api.put(`/orders/${editingOrder._id}`, payload);
      setEditingOrder(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update Sales Order');
    }
  };

  // Open Reassign Delivery Modal
  const handleOpenReassign = (o) => {
    setReassigningOrder(o);
    const currEmp = staffList.find(st => 
      st._id === (o.assignedTo?._id || o.assignedTo) ||
      st.user?._id === (o.assignedStaff?._id || o.assignedStaff)
    );
    setReassignEmployeeId(currEmp?._id || '');
  };

  const handleConfirmReassign = async (e) => {
    e.preventDefault();
    if (!reassignEmployeeId) {
      alert('Please select a delivery person to reassign.');
      return;
    }
    try {
      setError('');
      await api.put(`/orders/${reassigningOrder._id}/reassign-delivery`, { employeeId: reassignEmployeeId });
      setReassigningOrder(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to reassign delivery person');
    }
  };

  const handleAssignStaff = async (orderId, employeeId) => {
    try {
      setError('');
      if (!employeeId) {
        await api.put(`/orders/${orderId}/assign`, { staffId: null });
        fetchData();
        return;
      }
      await api.put(`/orders/${orderId}/assign`, { staffId: employeeId });
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to assign staff');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setError('');
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      fetchData(); // refresh the list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update order status');
    }
  };

  const handleProcessLoopNow = async (orderId) => {
    if (!window.confirm('Are you sure you want to generate the next order loop now?')) return;
    try {
      setError('');
      await api.post(`/orders/${orderId}/process-loop-now`);
      fetchData(); // refresh the list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process recurring order manually');
    }
  };

  const getYYYYMMDD = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dateCounts = useMemo(() => {
    const now = new Date();
    const todayStr = getYYYYMMDD(now);
    const tomStr = getYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const dayAfterTomStr = getYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));

    let todayCnt = 0, tomCnt = 0, dayAfterTomCnt = 0, overdueCnt = 0, futureCnt = 0;

    orders.forEach(o => {
      if (!o.deliveryDate) return;
      const orderDateStr = getYYYYMMDD(o.deliveryDate);
      if (!orderDateStr) return;

      if (orderDateStr === todayStr) todayCnt++;
      else if (orderDateStr === tomStr) tomCnt++;
      else if (orderDateStr === dayAfterTomStr) dayAfterTomCnt++;
      else if (orderDateStr > dayAfterTomStr) futureCnt++;
      else if (orderDateStr < todayStr) overdueCnt++;
    });

    return { all: orders.length, today: todayCnt, tomorrow: tomCnt, dayAfterTomorrow: dayAfterTomCnt, future: futureCnt, overdue: overdueCnt };
  }, [orders]);

  const filteredOrders = orders.filter(o => {
    if (selectedBranch) {
      const bId = o.branch?._id || o.branch;
      if (bId !== selectedBranch) return false;
    }
    if (selectedPaymentStatus && o.paymentStatus !== selectedPaymentStatus) return false;
    if (selectedStaff) {
      const matchedEmp = staffList.find(st => st._id === selectedStaff || st.user?._id === selectedStaff);
      const targetUserId = matchedEmp?.user?._id || selectedStaff;
      const targetEmpId = matchedEmp?._id || selectedStaff;
      const staffUserId = o.assignedStaff?._id || o.assignedStaff;
      const staffEmpId = o.assignedTo?._id || o.assignedTo;
      if (staffUserId !== targetUserId && staffEmpId !== targetEmpId && staffUserId !== selectedStaff && staffEmpId !== selectedStaff) return false;
    }
    if (selectedDateFilter) {
      const now = new Date();
      const todayStr = getYYYYMMDD(now);
      const tomStr = getYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      const dayAfterTomStr = getYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));

      const orderDateStr = getYYYYMMDD(o.deliveryDate);

      if (selectedDateFilter === 'today') {
        if (orderDateStr !== todayStr) return false;
      } else if (selectedDateFilter === 'tomorrow') {
        if (orderDateStr !== tomStr) return false;
      } else if (selectedDateFilter === 'day_after_tomorrow') {
        if (orderDateStr !== dayAfterTomStr) return false;
      } else if (selectedDateFilter === 'future') {
        if (orderDateStr <= dayAfterTomStr) return false;
      } else if (selectedDateFilter === 'overdue') {
        if (orderDateStr >= todayStr) return false;
      }
    }
    return true;
  });

  const handleSelectAll = (evt) => {
    if (evt.target.checked) {
      setSelectedIds(filteredOrders.map(o => o._id));
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
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected orders?`)) return;
    try {
      setError('');
      await api.post('/bulk/delete', { model: 'order', ids: selectedIds });
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
      await api.post('/bulk/status', { model: 'order', ids: selectedIds, status });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    }
  };

  const handleBulkAssignStaff = async (employeeId) => {
    if (!employeeId) return;
    try {
      setError('');
      const emp = staffList.find(st => st._id === employeeId || st.user?._id === employeeId);
      const targetStaffId = emp?.user?._id || emp?.user || employeeId;
      await api.post('/bulk/status', { model: 'order', ids: selectedIds, updates: { assignedStaff: targetStaffId, assignedTo: employeeId } });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to assign staff in bulk');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = orders.filter(o => selectedIds.includes(o._id));
    const cleanData = dataToExport.map(o => ({
      OrderRef: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
      Customer: o.customer?.name || o.customer,
      ItemsCount: o.items.length,
      TotalAmount: o.totalAmount,
      DeliveryDate: new Date(o.deliveryDate).toLocaleDateString(),
      Status: o.status,
      PaymentStatus: o.paymentStatus,
      Branch: o.branch?.name || o.branch
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "selected_orders.xlsx");
  };

  const upcomingLoops = orders.filter(o => {
    if (!o.isRecurring || o.recurringProcessed || o.status !== 'Delivered') return false;
    const baseDate = o.deliveredAt || o.deliveryDate || o.createdAt;
    if (!baseDate) return false;
    const nextRun = new Date(new Date(baseDate).getTime() + (o.recurringIntervalDays || 30) * 24 * 60 * 60 * 1000);
    const diffDays = (nextRun - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays <= 1;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Status Filter:</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px' }}
            >
              <option value="">All Orders</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="Packed">Packed</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Payment Status:</label>
            <select 
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px' }}
            >
              <option value="">All Payments</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {false && <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Assigned Staff:</label>
            <select 
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px' }}
            >
              <option value="">All Staff Members</option>
              {staffList.map(st => (
                <option key={st._id} value={st._id}>{st.name} ({st.role || 'Staff'})</option>
              ))}
            </select>
          </div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Date Filter:</label>
            <DateFilter
              value={selectedDateFilter || 'all'}
              onChange={({ filterType, startDate, endDate }) => {
                setSelectedDateFilter(filterType === 'all' ? '' : filterType);
                setDateRange({ filterType, startDate, endDate });
              }}
            />
          </div>

          {branches.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Branch:</label>
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px' }}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Create Order
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'var(--bg-main, #F6F8FA)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--primary, #087E8B)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> orders
          </span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary, #1F2937)' }}>Update Status:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-light, #D9E1E7)', background: '#fff', fontSize: '12px' }}
            >
              <option value="">Select...</option>
              <option value="Pending">New Order</option>
              <option value="Assigned">Assigned</option>
              <option value="Packed">Packed</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {false && <><label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary, #1F2937)' }}>Assign Staff:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkAssignStaff(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px' }}
            >
              <option value="">Select Staff Member...</option>
              {staffList.map(st => (
                <option key={st._id} value={st._id}>{st.name} ({st.role || 'Staff'})</option>
              ))}
            </select></>}

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

      {/* Recurring Customer Order Loops (Demand Center) Widget */}
      {!loading && (
        <div style={{ background: '#fff', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔄 Recurring Customer Order Loops (Demand Center)
                <span style={{ background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', fontSize: '12px', padding: '2px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {filteredLoopAlerts.length} Active Loop(s)
                </span>
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                Track customer order loops completing soon to generate next orders or stock up on required items.
              </p>
            </div>

            {/* Time Filter Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={loopFilterMode}
                onChange={(e) => setLoopFilterMode(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}
              >
                <option value="today">Completing Today</option>
                <option value="before_5_days">Completing in Next 5 Days (Default)</option>
                <option value="before_7_days">Completing in 7 Days</option>
                <option value="before_15_days">Completing in 15 Days</option>
                <option value="before_30_days">Completing in 30 Days</option>
                <option value="monthwise">Monthwise (This Month)</option>
                <option value="custom">Custom Days Window...</option>
                <option value="all">All Recurring Loops (All Time)</option>
              </select>

              {loopFilterMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customDaysWindow}
                    onChange={(e) => setCustomDaysWindow(Number(e.target.value))}
                    style={{ width: '70px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold' }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>days</span>
                </div>
              )}
            </div>
          </div>

          {/* Table of Loops */}
          {filteredLoopAlerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
              No customer order loops matching the selected timeframe ({loopFilterMode === 'custom' ? `${customDaysWindow} days` : loopFilterMode.replace(/_/g, ' ')}).
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textTransform: 'uppercase', fontSize: '11px', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Loop Cycle</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Prev Delivery</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Next Due Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Required Items</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoopAlerts.map(loop => {
                    const now = new Date();
                    const nextDate = new Date(loop.nextRun);
                    const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <tr key={loop.orderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                          {loop.customerName}
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>📱 {loop.customerMobile || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                            🔄 {loop.recurringIntervalDays} Days
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>
                          {new Date(loop.lastRun).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ 
                            background: diffDays <= 2 ? '#fee2e2' : diffDays <= 5 ? '#fef3c7' : '#f1f5f9',
                            color: diffDays <= 2 ? '#991b1b' : diffDays <= 5 ? '#92400e' : '#334155',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            📅 {new Date(loop.nextRun).toLocaleDateString()} ({diffDays <= 0 ? 'Due Today!' : `In ${diffDays} Day(s)`})
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {loop.items && loop.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {loop.items.map((it, idx) => (
                                <span key={idx} style={{ fontSize: '12px', color: '#334155', fontWeight: '600' }}>
                                  • {it.product?.name || 'Item'} (x{it.quantity})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{loop.itemsCount} items</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleTriggerLoopOrder(loop.orderId)}
                              style={{ padding: '6px 12px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              ⚡ Generate Order
                            </button>
                            <button
                              onClick={() => onNavigate && onNavigate('purchases')}
                              style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              🛒 Add to PO
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Orders Directory List */}
      {loading ? (
        <div>Loading orders runs...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Quick Schedule Date Filter Tabs Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '12px', 
            background: '#fff', 
            padding: '12px 16px', 
            borderRadius: 'var(--radius-lg, 10px)', 
            border: '1px solid var(--border-light, #D9E1E7)' 
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '4px' }}>📅 Filter by Date:</span>
              
              <button
                onClick={() => setSelectedDateFilter('')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedDateFilter === '' ? '2px solid var(--primary, #087E8B)' : '1px solid var(--border-light, #D9E1E7)',
                  background: selectedDateFilter === '' ? 'var(--primary-light, #E8F5F6)' : '#fff',
                  color: selectedDateFilter === '' ? 'var(--primary, #087E8B)' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📋 All Orders ({dateCounts.all})
              </button>

              <button
                onClick={() => setSelectedDateFilter('today')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedDateFilter === 'today' ? '2px solid #16a34a' : '1px solid var(--border-light, #D9E1E7)',
                  background: selectedDateFilter === 'today' ? '#f0fdf4' : '#fff',
                  color: selectedDateFilter === 'today' ? '#15803d' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📅 Today ({dateCounts.today})
              </button>

              <button
                onClick={() => setSelectedDateFilter('tomorrow')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedDateFilter === 'tomorrow' ? '2px solid #0284c7' : '1px solid var(--border-light, #D9E1E7)',
                  background: selectedDateFilter === 'tomorrow' ? '#f0f9ff' : '#fff',
                  color: selectedDateFilter === 'tomorrow' ? '#0369a1' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🌅 Tomorrow ({dateCounts.tomorrow})
              </button>

              <button
                onClick={() => setSelectedDateFilter('day_after_tomorrow')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedDateFilter === 'day_after_tomorrow' ? '2px solid var(--secondary, #17324D)' : '1px solid var(--border-light, #D9E1E7)',
                  background: selectedDateFilter === 'day_after_tomorrow' ? 'var(--border-subtle, #F1F5F9)' : '#fff',
                  color: selectedDateFilter === 'day_after_tomorrow' ? 'var(--secondary, #17324D)' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ⏩ Day After Tomorrow ({dateCounts.dayAfterTomorrow})
              </button>

              {dateCounts.overdue > 0 && (
                <button
                  onClick={() => setSelectedDateFilter('overdue')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: selectedDateFilter === 'overdue' ? '2px solid #dc2626' : '1px solid #fca5a5',
                    background: selectedDateFilter === 'overdue' ? '#fef2f2' : '#fff5f5',
                    color: selectedDateFilter === 'overdue' ? '#991b1b' : '#b91c1c',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⚠️ Overdue / Past ({dateCounts.overdue})
                </button>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>
              Showing {filteredOrders.length} of {orders.length} order(s)
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
                <th style={{ padding: '14px 20px', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    id="select-all-orders"
                    aria-label="Select all orders"
                    checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Sr. No.</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Order Ref</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Schedule Date</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Grand Total</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Fulfilment</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o, idx) => (
                  <tr 
                    key={o._id} 
                    onClick={() => setTrackingOrder(o)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(o._id)}
                        onChange={() => handleSelectRow(o._id)}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569', fontWeight: 'bold' }} onClick={(e) => e.stopPropagation()}>{idx + 1}</td>
                    <td style={{ padding: '14px 20px', color: '#1e293b' }}>
                      <div style={{ fontWeight: '700' }}>ORD-{o._id.toString().substring(18).toUpperCase()}</div>
                      {o.isRecurring && (
                        <div style={{ fontSize: '10px', color: 'var(--primary, #087E8B)', fontWeight: 'bold', marginTop: '2px' }}>
                          🔁 {formatRecurrenceLabel(o.recurringIntervalDays)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155', fontWeight: '600' }}>{o.customer?.name}</td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>Rs. {o.totalAmount.toFixed(2)}</td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: '600', fontSize: '12px' }}>
                      Owner managed
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <select 
                        value={o.status}
                        onChange={(e) => handleUpdateStatus(o._id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          fontSize: '11px', 
                          padding: '4px 24px 4px 8px', 
                          borderRadius: '6px', 
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none',
                          border: '1px solid rgba(0,0,0,0.1)',
                          appearance: 'none',
                          background: o.status === 'Delivered' ? 'var(--success-light, #D1E7DD)' 
                                      : o.status === 'Packed' ? 'var(--bg-main, #F6F8FA)'
                                      : o.status === 'Out for Delivery' ? 'var(--primary-light, #E8F5F6)'
                                      : o.status === 'Cancelled' ? 'var(--danger-light, #F8D7DA)' 
                                      : 'var(--warning-light, #FEF3C7)',
                          color: o.status === 'Delivered' ? 'var(--success, #198754)' : o.status === 'Packed' ? 'var(--secondary, #17324D)' : o.status === 'Out for Delivery' ? 'var(--primary, #087E8B)' : o.status === 'Cancelled' ? 'var(--danger, #DC3545)' : 'var(--warning, #D97706)'
                        }}
                      >
                        <option value="Pending">New Order</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Packed">Packed</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {!['Delivered', 'Completed', 'Cancelled'].includes(o.status) && (
                          <button 
                            onClick={() => handleOpenEditOrder(o)}
                            style={{ padding: '5px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '11px' }}
                            title="Edit order items, schedule, or recurring interval"
                          >
                            ✏️ Edit
                          </button>
                        )}
                        <button 
                          onClick={() => setTrackingOrder(o)}
                          style={{ padding: '5px 10px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '11px' }}
                        >
                          🚚 Track Run
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No orders found matching the filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Create Order Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Create New Dispatch Order</h3>
            
            <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Select Customer*</label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid);
                    const cust = customers.find(c => c._id === cid);
                    if (cust && cust.defaultRecurringDays && cust.defaultRecurringDays > 0) {
                      setIsRecurring(true);
                      setRecurringIntervalDays(cust.defaultRecurringDays);
                    } else {
                      setIsRecurring(false);
                      setRecurringIntervalDays(30);
                    }
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                  required
                >
                  <option value="">-- Select customer Profile --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.mobile})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Scheduled Delivery Date*</label>
                <input 
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isRecurring} 
                    onChange={(e) => setIsRecurring(e.target.checked)} 
                  />
                  Enable Order Loop (Recurring Delivery)
                </label>
                {isRecurring && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '24px' }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Repeat every:</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={recurringIntervalDays}
                      onChange={(e) => setRecurringIntervalDays(e.target.value)}
                      style={{ width: '70px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                    />
                    <span style={{ fontSize: '12px', color: '#475569' }}>days</span>
                  </div>
                )}
              </div>

              {/* Apply GST Tax Option */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isGstApplicable} 
                    onChange={(e) => setIsGstApplicable(e.target.checked)} 
                  />
                  Apply GST Tax for this Order (CGST + SGST)
                </label>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', paddingLeft: '24px' }}>
                  {isGstApplicable 
                    ? '✓ GST Tax (18%) will be calculated and added to the bill invoice.' 
                    : '✕ GST Tax is excluded for this order and will NOT be displayed on the bill.'}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Order Line Items</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orderItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        value={item.product}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                        required
                      >
                        <option value="">Choose Product</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Stock: {p.currentStock} | Price: Rs. {p.price.toFixed(2)})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                        style={{ width: '80px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                        required
                      />

                      <div style={{ width: '80px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>
                        Rs. {(item.price * item.quantity).toFixed(2)}
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  onClick={handleAddItemRow}
                  style={{ marginTop: '10px', padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ➕ Add Row
                </button>
              </div>

              {/* Total Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '10px', fontWeight: 'bold', fontSize: '16px', color: '#1e293b' }}>
                <span>Order Total:</span>
                <span style={{ color: '#166534' }}>Rs. {calculateTotal().toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setFormMode(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Audit Modal */}
      {trackingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                Track Run &raquo; ORD-{trackingOrder._id.toString().substring(18).toUpperCase()}
              </h3>
              <button 
                onClick={() => setTrackingOrder(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>Customer: {trackingOrder.customer?.name}</strong>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Address: {trackingOrder.customer?.address || 'N/A'}</p>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                  Assigned Staff / Driver: {' '}
                  <span style={{ color: (trackingOrder.assignedStaff || trackingOrder.assignedTo) ? '#166534' : '#b45309', fontWeight: 'bold' }}>
                    {(() => {
                      const st = staffList.find(s => 
                        s._id === (trackingOrder.assignedTo?._id || trackingOrder.assignedTo) ||
                        s._id === (trackingOrder.assignedStaff?._id || trackingOrder.assignedStaff) ||
                        (s.user && (s.user._id === (trackingOrder.assignedStaff?._id || trackingOrder.assignedStaff) || s.user._id === (trackingOrder.assignedTo?._id || trackingOrder.assignedTo)))
                      );
                      return st ? `${st.name} (${st.role || 'Staff'})` : (trackingOrder.assignedStaff?.name || trackingOrder.assignedTo?.name || '⚠️ Unassigned');
                    })()}
                  </span>
                </p>
              </div>

              {/* GPS Coordinates & Leaflet Map Container */}
              {trackingOrder.latitude && trackingOrder.longitude ? (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Delivery GPS Geolocation</h4>
                  <div style={{ width: '100%', height: '200px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                    <iframe 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      scrolling="no" 
                      marginHeight="0" 
                      marginWidth="0" 
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(trackingOrder.longitude)-0.005},${Number(trackingOrder.latitude)-0.005},${Number(trackingOrder.longitude)+0.005},${Number(trackingOrder.latitude)+0.005}&layer=mapnik&marker=${Number(trackingOrder.latitude)},${Number(trackingOrder.longitude)}`}
                    ></iframe>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  ℹ️ No GPS coordinates logged at moment of delivery.
                </div>
              )}

              {/* Status Line */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '15px' }}>Order Status Line</h4>
                
                {trackingOrder.status === 'Cancelled' ? (
                  <div style={{ padding: '15px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                    🚫 This order was cancelled.
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 10px', margin: '20px 0' }}>
                    {/* Background Line */}
                    <div style={{ position: 'absolute', top: '15px', left: '30px', right: '30px', height: '3px', background: '#e2e8f0', zIndex: 1 }}></div>
                    
                    {['Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered'].map((step, idx) => {
                      const isCompleted = trackingOrder.statusHistory?.some(h => h.status === step) || 
                                          ['Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered'].indexOf(trackingOrder.status) >= idx;
                      const isCurrent = trackingOrder.status === step;
                      
                      return (
                        <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, gap: '8px', flex: 1 }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: isCompleted ? 'var(--primary, #087E8B)' : '#fff', 
                            border: isCompleted ? '2px solid var(--primary, #087E8B)' : '2px solid #cbd5e1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isCompleted ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: '14px'
                          }}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: isCurrent ? '#0f172a' : (isCompleted ? 'var(--primary, #087E8B)' : '#64748b'), textAlign: 'center' }}>
                            {step === 'Pending' ? 'New Order' : step === 'Packed' ? 'Packed' : step}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detailed Run & Staff Assignment History Log */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 Order Run & Staff Assignee History
                </h4>
                {trackingOrder.statusHistory && trackingOrder.statusHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {trackingOrder.statusHistory.map((hist, hIdx) => {
                      const hStaff = staffList.find(st => 
                        st._id === (hist.assignedTo?._id || hist.assignedTo) ||
                        st._id === (hist.assignedStaff?._id || hist.assignedStaff) ||
                        (st.user && (st.user._id === (hist.assignedStaff?._id || hist.assignedStaff) || st.user._id === (hist.assignedTo?._id || hist.assignedTo)))
                      );
                      const staffName = hStaff ? `${hStaff.name} (${hStaff.role || 'Staff'})` : (hist.assignedStaff?.name || hist.assignedTo?.name || '⚠️ Unassigned');

                      return (
                        <div key={hIdx} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                          <div style={{ 
                            width: '28px', height: '28px', borderRadius: '50%', 
                            background: hist.status === 'Delivered' ? '#10b981' : hist.status === 'Packed' ? 'var(--secondary, #17324D)' : hist.status === 'Out for Delivery' ? 'var(--primary, #087E8B)' : '#f59e0b',
                            color: '#fff', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {hIdx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                                Status: {hist.status === 'Pending' ? 'New Order' : hist.status}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                📅 {new Date(hist.timestamp || trackingOrder.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#334155', marginTop: '3px', fontWeight: '600' }}>
                              👤 Assignee: <span style={{ color: (hStaff || hist.assignedStaff || hist.assignedTo) ? '#166534' : '#b45309' }}>{staffName}</span>
                            </div>
                            {hist.updatedBy && (
                              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                ✍️ Updated by: {hist.updatedBy.name || 'System User'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    Current Status: <strong>{trackingOrder.status}</strong> | Assigned Staff: <strong>{(() => {
                      const st = staffList.find(s => 
                        s._id === (trackingOrder.assignedTo?._id || trackingOrder.assignedTo) ||
                        s._id === (trackingOrder.assignedStaff?._id || trackingOrder.assignedStaff)
                      );
                      return st ? `${st.name} (${st.role || 'Staff'})` : (trackingOrder.assignedStaff?.name || trackingOrder.assignedTo?.name || '⚠️ Unassigned');
                    })()}</strong>
                  </div>
                )}
              </div>

              {/* Delivery Photo Proof */}
              {trackingOrder.deliveryProofUrl && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Delivery Photo Proof</h4>
                  <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <img 
                      src={trackingOrder.deliveryProofUrl} 
                      alt="Delivery Photo Proof" 
                      style={{ maxHeight: '150px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              {/* Proof signature */}
              {trackingOrder.signatureUrl && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Customer Digital Signature Proof</h4>
                  <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <img 
                      src={trackingOrder.signatureUrl} 
                      alt="Signature" 
                      style={{ maxHeight: '80px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              {/* Customer Feedback */}
              {trackingOrder.feedbackRating && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Customer Feedback</h4>
                  <div style={{ padding: '15px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fefce8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '20px', marginBottom: '8px' }}>
                      {'★'.repeat(Math.max(0, Math.min(5, trackingOrder.feedbackRating || 0)))}
                      {'☆'.repeat(Math.max(0, 5 - Math.min(5, trackingOrder.feedbackRating || 0)))}
                    </div>
                    {trackingOrder.feedbackComment && <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>"{trackingOrder.feedbackComment}"</p>}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Edit Sales Order Modal */}
      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
              ✏️ Edit Sales Order — ORD-{editingOrder._id.toString().substring(18).toUpperCase()}
            </h3>

            <form onSubmit={handleUpdateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Customer*</label>
                <select
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  required
                >
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.mobile})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Schedule Delivery Date*</label>
                  <input 
                    type="date"
                    value={editDeliveryDate}
                    onChange={(e) => setEditDeliveryDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Recurring Loop Interval</label>
                  <select
                    value={editRecurringIntervalDays}
                    onChange={(e) => setEditRecurringIntervalDays(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="7">Every Week (7 Days)</option>
                    <option value="14">Every 2 Weeks (14 Days)</option>
                    <option value="15">Every 15 Days</option>
                    <option value="30">Every Month (30 Days)</option>
                    <option value="60">Every 2 Months (60 Days)</option>
                    <option value="90">Every Quarter (90 Days)</option>
                    <option value="365">Every Year (365 Days)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  <input 
                    type="checkbox"
                    checked={editIsRecurring}
                    onChange={(e) => setEditIsRecurring(e.target.checked)}
                  />
                  Enable Auto-Recurring Order Loop
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  <input 
                    type="checkbox"
                    checked={editIsGstApplicable}
                    onChange={(e) => setEditIsGstApplicable(e.target.checked)}
                  />
                  Apply 18% GST Breakdown
                </label>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Ordered Products & Quantities</label>
                  <button 
                    type="button" 
                    onClick={() => setEditOrderItems([...editOrderItems, { product: products[0]?._id || '', quantity: 1, price: products[0]?.price || 0 }])}
                    style={{ padding: '4px 10px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ➕ Add Product
                  </button>
                </div>

                {editOrderItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <select
                      value={item.product}
                      onChange={(e) => {
                        const selectedProd = products.find(p => p._id === e.target.value);
                        const updated = [...editOrderItems];
                        updated[idx].product = e.target.value;
                        updated[idx].price = selectedProd ? selectedProd.price : 0;
                        setEditOrderItems(updated);
                      }}
                      style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                    >
                      {products.map(p => (
                        <option key={p._id} value={p._id}>{p.name} (Rs. {p.price})</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...editOrderItems];
                        updated[idx].quantity = Number(e.target.value);
                        setEditOrderItems(updated);
                      }}
                      style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Unit Price"
                      value={item.price}
                      onChange={(e) => {
                        const updated = [...editOrderItems];
                        updated[idx].price = Number(e.target.value);
                        setEditOrderItems(updated);
                      }}
                      style={{ width: '90px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Remarks / Order Notes</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Special instructions or notes..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingOrder(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save Sales Order Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Delivery Person Modal */}
      {reassigningOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
              👤 Reassign Delivery Person — ORD-{reassigningOrder._id.toString().substring(18).toUpperCase()}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Select a new staff member to handle delivery for customer {reassigningOrder.customer?.name}.
            </p>

            <form onSubmit={handleConfirmReassign} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Assign Delivery Staff*</label>
                <select
                  value={reassignEmployeeId}
                  onChange={(e) => setReassignEmployeeId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: '600' }}
                  required
                >
                  <option value="">Select Delivery Staff...</option>
                  {staffList.map(st => (
                    <option key={st._id} value={st._id}>{st.name} ({st.role || st.designation || 'Staff'}) — {st.mobile || 'No Mobile'}</option>
                  ))}
                </select>
              </div>

              {/* Assignment Audit History */}
              {reassigningOrder.assignmentHistory && reassigningOrder.assignmentHistory.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>
                    📜 Previous Assignment History ({reassigningOrder.assignmentHistory.length})
                  </div>
                  {reassigningOrder.assignmentHistory.map((h, idx) => (
                    <div key={idx} style={{ fontSize: '11px', color: '#475569', borderBottom: '1px solid #e2e8f0', padding: '4px 0' }}>
                      • Assigned to <strong>{h.assignedTo?.name || 'Staff'}</strong> by {h.assignedBy} on {new Date(h.date).toLocaleString()}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReassigningOrder(null)}
                  style={{ padding: '10px 18px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Reassignment 🚚
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
