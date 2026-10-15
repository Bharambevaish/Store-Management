import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import DateFilter from '../components/DateFilter.jsx';
import Toast from '../components/Toast.jsx';
import { validatePositiveNumber, validateRequired } from '../utils/formValidation.js';

export default function Purchases() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  // Bulk and Filter States
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [dateRange, setDateRange] = useState({ filterType: 'all', startDate: '', endDate: '' });

  // Form State for Add PO
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [poItems, setPoItems] = useState([{ product: '', quantity: 1, costPrice: 0 }]);

  // Edit PO State
  const [editingPo, setEditingPo] = useState(null);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editPoItems, setEditPoItems] = useState([]);
  const [editStatus, setEditStatus] = useState('Pending');

  // Receive PO Modal State
  const [receivingPo, setReceivingPo] = useState(null);
  const [receiveInputs, setReceiveInputs] = useState([]); // [{ productId, receiveQty, location, remarks }]

  // Receiving History Modal State
  const [historyPo, setHistoryPo] = useState(null);

  const fetchData = async () => {
    try {
      const [poRes, supRes, prodRes, branchRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/branches')
      ]);
      setPurchaseOrders(poRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setBranches(branchRes.data);
      
      if (branchRes.data.length > 0) setBranchId(branchRes.data[0]._id);
      if (supRes.data.length > 0) setSelectedSupplierId(supRes.data[0]._id);
    } catch (err) {
      console.error(err);
      setError('Failed to load purchase orders registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setSelectedSupplierId(suppliers[0]?._id || '');
    setExpectedDate('');
    setBranchId(branches[0]?._id || '');
    setPoItems([{ product: '', quantity: 1, costPrice: 0 }]);
    setShowAdd(true);
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...poItems];
    updated[index].product = prodId;
    updated[index].costPrice = selectedProd ? Math.floor(selectedProd.price * 0.7) : 0;
    setPoItems(updated);
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...poItems];
    updated[index][field] = Number(value);
    setPoItems(updated);
  };

  const handleAddItemRow = () => {
    setPoItems([...poItems, { product: '', quantity: 1, costPrice: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (poItems.length === 1) return;
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return poItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  };

  const handleSubmitPO = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    if (!selectedSupplierId) {
      setError('Please select a supplier vendor');
      setToast({ type: 'error', message: 'Please select a supplier vendor' });
      return;
    }
    const invalidItem = poItems.find(it => !it.product || !it.quantity || Number(it.quantity) <= 0);
    if (invalidItem) {
      setError('Please select a product and enter a valid positive quantity for all line items.');
      setToast({ type: 'error', message: 'Please select a product and enter a valid positive quantity for all line items.' });
      return;
    }
    try {
      const payload = {
        supplierId: selectedSupplierId?._id || selectedSupplierId,
        expectedDeliveryDate: expectedDate,
        branchId: branchId?._id || branchId,
        items: poItems.map(it => ({
          product: it.product?._id || it.product,
          quantity: it.quantity,
          costPrice: it.costPrice
        }))
      };
      await api.post('/purchases', payload);
      setSuccess('Purchase Order generated successfully! ✅');
      setToast({ type: 'success', message: 'Purchase Order generated successfully! ✅' });
      setShowAdd(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to dispatch purchase order';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  // Open Edit PO Modal
  const handleOpenEdit = (po) => {
    setEditingPo(po);
    setEditSupplierId(po.supplier?._id || po.supplier || '');
    setEditExpectedDate(po.expectedDeliveryDate ? po.expectedDeliveryDate.substring(0, 10) : '');
    setEditStatus(po.status || 'Pending');
    setEditPoItems(po.items.map(it => ({
      product: it.product?._id || it.product,
      quantity: it.quantity,
      costPrice: it.costPrice,
      receivedQuantity: it.receivedQuantity || 0
    })));
  };

  const handleUpdatePO = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      const payload = {
        supplierId: editSupplierId,
        expectedDeliveryDate: editExpectedDate,
        status: editStatus,
        items: editPoItems.map(it => ({ product: it.product, quantity: it.quantity, costPrice: it.costPrice }))
      };
      const res = await api.put(`/purchases/${editingPo._id}`, payload);
      setSuccess(res.data.message || 'Purchase Order updated successfully! ✅');
      setEditingPo(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update Purchase Order');
    }
  };

  // Open Partial Receive Modal
  const handleOpenReceive = (po) => {
    setReceivingPo(po);
    const initialInputs = po.items.map(it => {
      const pId = it.product?._id || it.product;
      const rec = it.receivedQuantity || 0;
      const pending = Math.max(0, it.quantity - rec);
      return {
        productId: pId,
        productName: it.product?.name || 'Product',
        orderedQty: it.quantity,
        receivedQty: rec,
        pendingQty: pending,
        receiveQty: pending, // Default input to full pending
        location: 'Main Warehouse',
        remarks: 'Batch receipt'
      };
    });
    setReceiveInputs(initialInputs);
  };

  const handleReceiveInputChange = (index, field, value) => {
    const updated = [...receiveInputs];
    updated[index][field] = field === 'receiveQty' ? Math.max(0, Number(value)) : value;
    setReceiveInputs(updated);
  };

  const handleSubmitReceive = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      const payload = {
        items: receiveInputs.map(it => ({
          productId: it.productId,
          receiveQty: Number(it.receiveQty),
          location: it.location,
          remarks: it.remarks
        }))
      };
      const res = await api.put(`/purchases/${receivingPo._id}/receive`, payload);
      setSuccess(res.data.message || 'Items received successfully! Stock updated. 📦');
      setReceivingPo(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to receive PO items');
    }
  };

  const handleSendWA = (po) => {
    const vendor = po.supplier;
    if (!vendor || !vendor.contact) {
      alert('This vendor does not have a contact number saved.');
      return;
    }
    
    let mobile = vendor.contact.replace(/\D/g, '');
    if (mobile.length === 10) mobile = `91${mobile}`;

    const msg = `Hello ${vendor.name},\n\nA friendly reminder about Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) dispatched to you.\n\nTotal Items: ${po.items.length}\nExpected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}\nStatus: ${po.status}\n\nPlease update us on the delivery schedule. Thank you!`;
    
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleAutoSendWA = async (poId) => {
    try {
      const res = await api.post(`/purchases/${poId}/whatsapp`);
      setSuccess(res.data.message || 'WhatsApp notification sent successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send WhatsApp message');
    }
  };

  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    if (selectedStatus && po.status !== selectedStatus) return false;
    if (selectedSupplier) {
      const sId = po.supplier?._id || po.supplier;
      if (sId !== selectedSupplier) return false;
    }
    if (selectedBranch) {
      const bId = po.branch?._id || po.branch;
      if (bId !== selectedBranch) return false;
    }
    return true;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredPurchaseOrders.map(po => po._id));
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
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected purchase orders?`)) return;
    try {
      setError('');
      setSuccess('');
      await api.post('/bulk/delete', { model: 'purchaseorder', ids: selectedIds });
      setSuccess(`Deleted ${selectedIds.length} purchase orders. ✅`);
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
      setSuccess('');
      await api.post('/bulk/status', { model: 'purchaseorder', ids: selectedIds, status });
      setSuccess(`Updated status to ${status} for ${selectedIds.length} orders. ✅`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk status update');
    }
  };

  const handleBulkExport = () => {
    const selectedData = filteredPurchaseOrders.filter(po => selectedIds.includes(po._id));
    const exportRows = selectedData.map(po => ({
      'PO Ref ID': `PO-${po._id.toString().substring(18).toUpperCase()}`,
      'Supplier': po.supplier?.name || 'N/A',
      'Branch': po.branch?.name || 'N/A',
      'Expected Delivery': new Date(po.expectedDeliveryDate).toLocaleDateString(),
      'Total Cost': po.totalCost,
      'Status': po.status,
      'Date Created': new Date(po.createdAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
    XLSX.writeFile(wb, `Purchase_Orders_Export_${new Date().toISOString().substring(0,10)}.xlsx`);
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading purchase order registry...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
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

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>Procurement & Purchase Orders</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', margin: 0 }}>Manage supplier orders, partial receiving batches, and inventory replenishment.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '12px 20px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          ➕ Dispatch Purchase Order
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'var(--bg-card, #FFFFFF)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>PO Status</label>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Ordered">Ordered</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Fully Received">Fully Received</option>
            <option value="Locked">Locked</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Supplier</label>
          <select 
            value={selectedSupplier} 
            onChange={(e) => setSelectedSupplier(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
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
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'var(--primary-light, #E8F5F6)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--primary, #087E8B)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> purchase orders
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary, #087E8B)' }}>Update Status:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px' }}
            >
              <option value="">Select...</option>
              <option value="Pending">Pending</option>
              <option value="Ordered">Ordered</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Fully Received">Fully Received</option>
              <option value="Locked">Locked</option>
              <option value="Cancelled">Cancelled</option>
            </select>

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
              style={{ padding: '8px 16px', background: '#cbd5e1', color: '#1e293b', border: 'none', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* PO Listing */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
              <th style={{ padding: '14px 16px', width: '40px' }}>
                <input 
                  type="checkbox"
                  checked={filteredPurchaseOrders.length > 0 && selectedIds.length === filteredPurchaseOrders.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>PO Ref ID</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Supplier</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Delivery Expected</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Items Progress</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Cost Value</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchaseOrders.length > 0 ? (
              filteredPurchaseOrders.map((po) => {
                const totalOrd = po.items.reduce((s, i) => s + i.quantity, 0);
                const totalRec = po.items.reduce((s, i) => s + (i.receivedQuantity || 0), 0);
                const canEdit = !['Fully Received', 'Received', 'Locked', 'Cancelled'].includes(po.status);
                const canReceive = !['Fully Received', 'Received', 'Locked', 'Cancelled'].includes(po.status);

                let statusBg = 'var(--primary-light, #E8F5F6)';
                let statusColor = 'var(--primary, #087E8B)';
                if (po.status === 'Fully Received' || po.status === 'Received') {
                  statusBg = '#d1fae5'; statusColor = '#065f46';
                } else if (po.status === 'Partially Received') {
                  statusBg = '#fef3c7'; statusColor = '#92400e';
                } else if (po.status === 'Cancelled') {
                  statusBg = '#fee2e2'; statusColor = '#b91c1c';
                } else if (po.status === 'Locked') {
                  statusBg = '#f1f5f9'; statusColor = '#475569';
                }

                return (
                  <tr key={po._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', width: '40px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(po._id)}
                        onChange={() => handleSelectRow(po._id)}
                      />
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#1e293b' }}>
                      PO-{po._id.toString().substring(18).toUpperCase()}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155', fontWeight: '600' }}>{po.supplier?.name || 'N/A'}</td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>{new Date(po.expectedDeliveryDate).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                      <div style={{ fontWeight: '600', color: '#334155' }}>
                        {totalRec} / {totalOrd} Units Received
                      </div>
                      <div style={{ width: '100px', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${totalOrd > 0 ? (totalRec / totalOrd) * 100 : 0}%`, height: '100%', background: po.status === 'Fully Received' ? '#10b981' : '#f59e0b', transition: 'width 0.3s' }} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#b91c1c', fontWeight: 'bold' }}>Rs. {po.totalCost.toFixed(2)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        background: statusBg,
                        color: statusColor
                      }}>
                        {po.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        
                        {canReceive && (
                          <button 
                            onClick={() => handleOpenReceive(po)}
                            style={{ padding: '6px 12px', background: '#d9f99d', color: '#365314', border: '1px solid #bef264', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            title="Enter partial received quantity"
                          >
                            📦 Receive Qty
                          </button>
                        )}

                        {canEdit && (
                          <button 
                            onClick={() => handleOpenEdit(po)}
                            style={{ padding: '6px 12px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            title="Edit Purchase Order details"
                          >
                            ✏️ Edit
                          </button>
                        )}

                        {po.receivingHistory && po.receivingHistory.length > 0 && (
                          <button 
                            onClick={() => setHistoryPo(po)}
                            style={{ padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            title="View partial receiving audit history"
                          >
                            📜 History ({po.receivingHistory.length})
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No purchase orders found matching the filter criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Partial Receive Modal */}
      {receivingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
              📦 Partial Purchase Receiving — PO-{receivingPo._id.toString().substring(18).toUpperCase()}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Enter the exact quantity received for each line item. Stock will increase only by the entered quantities.
            </p>

            <form onSubmit={handleSubmitReceive}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Name</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Ordered</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Prev Rec</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Pending</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '100px' }}>Receive Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Warehouse Location</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveInputs.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: '600', color: '#1e293b' }}>{item.productName}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.orderedQty}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#059669', fontWeight: '600' }}>{item.receivedQty}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#d97706', fontWeight: '600' }}>{item.pendingQty}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={item.pendingQty}
                          value={item.receiveQty}
                          onChange={(e) => handleReceiveInputChange(idx, 'receiveQty', e.target.value)}
                          style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                        />
                      </td>
                      <td style={{ padding: '10px' }}>
                        <input
                          type="text"
                          value={item.location}
                          onChange={(e) => handleReceiveInputChange(idx, 'location', e.target.value)}
                          style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                        />
                      </td>
                      <td style={{ padding: '10px' }}>
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handleReceiveInputChange(idx, 'remarks', e.target.value)}
                          style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setReceivingPo(null)}
                  style={{ padding: '10px 18px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Partial Receipt 📦
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receiving History Modal */}
      {historyPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                📜 Receiving History Log — PO-{historyPo._id.toString().substring(18).toUpperCase()}
              </h3>
              <button onClick={() => setHistoryPo(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            {historyPo.receivingHistory.map((batch, bIdx) => (
              <div key={bIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>
                  <span>Batch #{bIdx + 1} — Received by {batch.receivedBy}</span>
                  <span>{new Date(batch.date).toLocaleString()}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#64748b', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '4px' }}>Product</th>
                      <th style={{ padding: '4px', textAlign: 'center' }}>Qty Received</th>
                      <th style={{ padding: '4px' }}>Location</th>
                      <th style={{ padding: '4px' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.items.map((it, iIdx) => (
                      <tr key={iIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 4px', fontWeight: '600' }}>{it.product?.name || 'Product'}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#059669', fontWeight: 'bold' }}>+{it.quantity}</td>
                        <td style={{ padding: '6px 4px' }}>{it.location || 'Warehouse'}</td>
                        <td style={{ padding: '6px 4px', color: '#64748b' }}>{it.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {editingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
              ✏️ Edit Purchase Order — PO-{editingPo._id.toString().substring(18).toUpperCase()}
            </h3>

            <form onSubmit={handleUpdatePO} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Supplier Vendor*</label>
                <select 
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Expected Delivery Date*</label>
                  <input 
                    type="date"
                    value={editExpectedDate}
                    onChange={(e) => setEditExpectedDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>PO Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Locked">Locked</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>PO Line Items</label>
                  <button 
                    type="button" 
                    onClick={() => setEditPoItems([...editPoItems, { product: products[0]?._id || '', quantity: 1, costPrice: 0 }])}
                    style={{ padding: '4px 10px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ➕ Add Line Item
                  </button>
                </div>

                {editPoItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <select
                      value={item.product}
                      onChange={(e) => {
                        const updated = [...editPoItems];
                        updated[idx].product = e.target.value;
                        setEditPoItems(updated);
                      }}
                      style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                    >
                      {products.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...editPoItems];
                        updated[idx].quantity = Number(e.target.value);
                        setEditPoItems(updated);
                      }}
                      style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Cost Price"
                      value={item.costPrice}
                      onChange={(e) => {
                        const updated = [...editPoItems];
                        updated[idx].costPrice = Number(e.target.value);
                        setEditPoItems(updated);
                      }}
                      style={{ width: '100px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingPo(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add PO Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Create Supplier Purchase Order</h3>
            
            <form onSubmit={handleSubmitPO} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Select Supplier Vendor*</label>
                <select 
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Expected Delivery Date*</label>
                  <input 
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Branch Scoped*</label>
                  <select 
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                  >
                    {branches.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Order Products List*</label>
                  <button 
                    type="button" 
                    onClick={handleAddItemRow}
                    style={{ padding: '4px 10px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ➕ Add Product
                  </button>
                </div>

                {poItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <select 
                      value={item.product}
                      onChange={(e) => handleItemProductChange(idx, e.target.value)}
                      style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: '#fff' }}
                      required
                    >
                      <option value="">Select Product...</option>
                      {products.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                      style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                      required
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Cost Price"
                      value={item.costPrice}
                      onChange={(e) => handleItemFieldChange(idx, 'costPrice', e.target.value)}
                      style={{ width: '100px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                      required
                    />
                    {poItems.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f1f5f9', borderRadius: '8px', marginTop: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>Total Estimated Cost:</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary, #087E8B)' }}>Rs. {calculateTotal().toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Dispatch PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
