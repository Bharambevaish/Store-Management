import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Toast from '../components/Toast.jsx';
import BulkImportModal from '../components/BulkImportModal.jsx';
import DateFilter from '../components/DateFilter.jsx';
import {
  validateRequired,
  validateName,
  validateProductName,
  validateCategory,
  validateUnit,
  sanitizeNameInput,
  sanitizeNumericInput,
  sanitizePriceInput,
  validatePositiveNumber,
  validateRetailVsPurchase,
  validateExpiryVsMfgDate,
  validateHSN,
  trimObjectValues
} from '../utils/formValidation.js';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reorderList, setReorderList] = useState([]);
  const [expiryBatches, setExpiryBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  // Bulk and Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState(''); // 'all' | 'low' | 'out' | 'in'
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPriceChange, setBulkPriceChange] = useState('');
  const [bulkCategoryChange, setBulkCategoryChange] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('all'); // all | reorder | expiry
  const [expiryCategoryFilter, setExpiryCategoryFilter] = useState('all'); // all | expired | 30days | 15days | 7days

  // Bulk Import Modal state
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Form State for CRUD & Validation
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    name: '', category: '', unit: '', price: '', purchasePrice: '', currentStock: '', lowStockThreshold: '', linkedVendor: '', hsnCode: 'HSN3004', branchId: '', hasExpiryTracking: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Batch Registration Modal state
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    productId: '', batchNumber: '', expiryDate: '', mfgDate: '', quantity: '', purchasePrice: '', retailPrice: '', vendorId: '', branchId: ''
  });
  const [batchErrors, setBatchErrors] = useState({});

  // Stock Adjustment Modal state
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ newQty: '', reason: 'recount' });
  const [selectedProductLogs, setSelectedProductLogs] = useState([]);
  const [showLogsModal, setShowLogsModal] = useState(null);

  // Quick Order Modal state
  const [orderingProduct, setOrderingProduct] = useState(null);
  const [orderForm, setOrderForm] = useState({ quantity: '', expectedDeliveryDate: '' });

  // Stock Alerts & Admin Popup Settings State
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
  const [alertPopupTab, setAlertPopupTab] = useState('low'); // 'low' | 'out'

  const lowStockProducts = products.filter(p => p.currentStock <= (p.lowStockThreshold || alertSettings.globalLowThreshold));
  const outOfStockProducts = products.filter(p => p.currentStock === 0);

  const fetchData = async () => {
    try {
      const [prodRes, venRes, branchRes, reorderRes, batchRes] = await Promise.all([
        api.get('/products'),
        api.get('/vendors'),
        api.get('/branches'),
        api.get('/products/reorder-list'),
        api.get('/batches')
      ]);
      setProducts(prodRes.data);
      setVendors(venRes.data);
      setBranches(branchRes.data);
      setReorderList(reorderRes.data);
      setExpiryBatches(batchRes.data);
      if (branchRes.data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: branchRes.data[0]._id }));
      }
      if (venRes.data.length > 0) {
        setFormData(prev => ({ ...prev, linkedVendor: venRes.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch product information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showAdd) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAdd]);

  const [manuallyClosed, setManuallyClosed] = useState(false);

  const handleCloseAlert = () => {
    setShowAlertPopup(false);
    setManuallyClosed(true);
    sessionStorage.setItem('last_stock_popup_time', Date.now().toString());
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
    setSuccess('Stock Alert & Popup settings updated successfully! ✅');
    setShowSettingsModal(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const errs = {};

    const nameErr = validateProductName(formData.name, 'Product Name');
    if (nameErr) errs.name = nameErr;

    const catErr = validateCategory(formData.category, 'Category Name');
    if (catErr) errs.category = catErr;

    const unitErr = validateUnit(formData.unit, 'Unit');
    if (unitErr) errs.unit = unitErr;

    const priceErr = validatePositiveNumber(formData.price, 'Retail Price', false);
    if (priceErr) errs.price = priceErr;

    if (formData.purchasePrice !== '') {
      const purErr = validatePositiveNumber(formData.purchasePrice, 'Purchase Price', true);
      if (purErr) errs.purchasePrice = purErr;
      const compareErr = validateRetailVsPurchase(formData.purchasePrice, formData.price);
      if (compareErr) errs.price = compareErr;
    }

    const stockErr = validatePositiveNumber(formData.currentStock, 'Initial Stock', true);
    if (stockErr) errs.currentStock = stockErr;

    const reorderErr = validatePositiveNumber(formData.lowStockThreshold, 'Reorder Level', true);
    if (reorderErr) errs.lowStockThreshold = reorderErr;

    const hsnErr = validateHSN(formData.hsnCode, false);
    if (hsnErr) errs.hsnCode = hsnErr;

    if (!formData.linkedVendor) errs.linkedVendor = 'Supplier Vendor is required';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setFormErrors({});
    const defaultBranchId = formData.branchId || (branches.length > 0 ? branches[0]._id : '');
    const cleanData = {
      ...trimObjectValues(formData),
      branchId: defaultBranchId
    };

    try {
      await api.post('/products', cleanData);
      setToast({ type: 'success', message: 'Product registered successfully! ✅' });
      setShowAdd(false);
      setFormData({
        name: '', category: '', unit: '', price: '', purchasePrice: '', currentStock: '', lowStockThreshold: '', linkedVendor: vendors[0]?._id || '', hsnCode: 'HSN3004', branchId: branches[0]?._id || '', hasExpiryTracking: true
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to create product';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setBatchErrors({});
    const errs = {};

    if (!batchForm.productId) errs.productId = 'Please select a product';
    if (!batchForm.batchNumber || !batchForm.batchNumber.trim()) errs.batchNumber = 'Batch Number is required';

    const qtyErr = validatePositiveNumber(batchForm.quantity, 'Quantity', false);
    if (qtyErr) errs.quantity = qtyErr;

    if (batchForm.retailPrice && batchForm.purchasePrice) {
      const cmpErr = validateRetailVsPurchase(batchForm.purchasePrice, batchForm.retailPrice);
      if (cmpErr) errs.retailPrice = cmpErr;
    }

    if (batchForm.mfgDate && batchForm.expiryDate) {
      const expErr = validateExpiryVsMfgDate(batchForm.mfgDate, batchForm.expiryDate);
      if (expErr) errs.expiryDate = expErr;
    }

    if (Object.keys(errs).length > 0) {
      setBatchErrors(errs);
      return;
    }

    try {
      await api.post('/batches', batchForm);
      setToast({ type: 'success', message: 'Batch registered successfully! ✅' });
      setShowAddBatchModal(false);
      setBatchForm({
        productId: '', batchNumber: '', expiryDate: '', mfgDate: '', quantity: '', purchasePrice: '', retailPrice: '', vendorId: '', branchId: ''
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to register batch';
      setToast({ type: 'error', message: msg });
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.put(`/products/${adjustingProduct._id}/adjust-manual`, adjustForm);
      setSuccess(`Product stock updated successfully! ✅`);
      setAdjustingProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.post('/purchases', {
        supplierId: orderingProduct.linkedVendor?._id || orderingProduct.linkedVendor,
        items: [{
          product: orderingProduct._id?._id || orderingProduct._id,
          quantity: Number(orderForm.quantity),
          costPrice: orderingProduct.price || 0
        }],
        expectedDeliveryDate: orderForm.expectedDeliveryDate,
        branchId: orderingProduct.branch?._id || orderingProduct.branch || branches[0]?._id
      });
      setSuccess('Purchase Order created successfully! ✅');
      setOrderingProduct(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create purchase order');
    }
  };

  const handleViewLogs = async (product) => {
    try {
      const res = await api.get(`/products/${product._id}/stock-logs`);
      setSelectedProductLogs(res.data);
      setShowLogsModal(product);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch stock log logs');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setSuccess('');
    setError('');
    try {
      await api.delete(`/products/${id}`);
      setSuccess('Product deleted successfully. ✅');
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to delete product');
    }
  };

  const filteredProducts = activeTab === 'all' 
    ? products.filter(p => {
        if (search) {
          const q = search.toLowerCase();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesCat = p.category.toLowerCase().includes(q);
          const matchesHsn = p.hsnCode && p.hsnCode.toLowerCase().includes(q);
          if (!matchesName && !matchesCat && !matchesHsn) return false;
        }
        if (selectedCategory && p.category !== selectedCategory) return false;
        if (selectedVendor) {
          const vId = p.linkedVendor?._id || p.linkedVendor;
          if (vId !== selectedVendor) return false;
        }
        if (selectedBranch) {
          const bId = p.branch?._id || p.branch;
          if (bId !== selectedBranch) return false;
        }
        if (selectedStockStatus) {
          if (selectedStockStatus === 'low' && !(p.currentStock <= p.lowStockThreshold)) return false;
          if (selectedStockStatus === 'out' && p.currentStock > 0) return false;
          if (selectedStockStatus === 'in' && p.currentStock === 0) return false;
        }
        return true;
      })
    : reorderList.filter(p => {
        if (search) {
          const q = search.toLowerCase();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesCat = p.category.toLowerCase().includes(q);
          const matchesHsn = p.hsnCode && p.hsnCode.toLowerCase().includes(q);
          if (!matchesName && !matchesCat && !matchesHsn) return false;
        }
        if (selectedCategory && p.category !== selectedCategory) return false;
        if (selectedVendor) {
          const vId = p.linkedVendor?._id || p.linkedVendor;
          if (vId !== selectedVendor) return false;
        }
        if (selectedBranch) {
          const bId = p.branch?._id || p.branch;
          if (bId !== selectedBranch) return false;
        }
        return true;
      });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map(p => p._id));
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
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected products?`)) return;
    try {
      setError('');
      setSuccess('');
      await api.post('/bulk/delete', { model: 'product', ids: selectedIds });
      setSuccess(`Deleted ${selectedIds.length} products. ✅`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkPriceAdjust = async (pct) => {
    if (!pct) return;
    if (!window.confirm(`Are you sure you want to adjust the prices of the ${selectedIds.length} selected products by ${pct}%?`)) return;
    try {
      setError('');
      setSuccess('');
      const multiplier = 1 + (Number(pct) / 100);
      const selectedProds = products.filter(p => selectedIds.includes(p._id));
      await Promise.all(selectedProds.map(prod => {
        const newPrice = Math.max(0, Number((prod.price * multiplier).toFixed(2)));
        return api.put(`/products/${prod._id}`, {
          name: prod.name,
          category: prod.category,
          unit: prod.unit,
          price: newPrice,
          currentStock: prod.currentStock,
          lowStockThreshold: prod.lowStockThreshold,
          linkedVendor: prod.linkedVendor?._id || prod.linkedVendor,
          hsnCode: prod.hsnCode || 'HSN3004',
          branch: prod.branch?._id || prod.branch
        });
      }));
      setSuccess(`Adjusted prices for ${selectedIds.length} products by ${pct}%! ✅`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to adjust prices');
    }
  };

  const handleBulkCategoryUpdate = async (cat) => {
    if (!cat) return;
    try {
      setError('');
      setSuccess('');
      await api.post('/bulk/status', { model: 'product', ids: selectedIds, updates: { category: cat } });
      setSuccess(`Updated category for ${selectedIds.length} products to "${cat}"! ✅`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update category');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = products.filter(p => selectedIds.includes(p._id));
    const cleanData = dataToExport.map(p => ({
      Name: p.name,
      Category: p.category,
      Unit: p.unit,
      Price: p.price,
      CurrentStock: p.currentStock,
      LowStockThreshold: p.lowStockThreshold,
      Supplier: p.linkedVendor?.name || p.linkedVendor,
      HSNCode: p.hsnCode || ''
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "selected_products.xlsx");
  };

  const activeProducts = filteredProducts;

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading products directory...</div>;

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

      {/* Search and Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
        <input 
          type="text"
          placeholder="🔍 Search products by name, category, or HSN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '280px', outline: 'none', fontSize: '13px' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Categories</option>
            {[...new Set(products.map(p => p.category))].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <select 
            value={selectedStockStatus} 
            onChange={(e) => setSelectedStockStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Stock Statuses</option>
            <option value="low">Low Stock Alert</option>
            <option value="out">Out of Stock</option>
            <option value="in">In Stock (Positive)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <select 
            value={selectedVendor} 
            onChange={(e) => setSelectedVendor(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Suppliers</option>
            {vendors.map(v => (
              <option key={v._id} value={v._id}>{v.name}</option>
            ))}
          </select>
        </div>

        {branches.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox"
            id="select-all-products"
            checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
            onChange={handleSelectAll}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="select-all-products" style={{ fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Select All Visible</label>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'var(--bg-main, #F6F8FA)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--primary, #087E8B)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> products
          </span>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Bulk Category Update */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary, #1F2937)' }}>Move to Cat:</label>
              <input 
                type="text"
                placeholder="New Category"
                value={bulkCategoryChange}
                onChange={(e) => setBulkCategoryChange(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light, #D9E1E7)', fontSize: '12px', width: '120px' }}
              />
              <button 
                onClick={() => {
                  if(bulkCategoryChange) {
                    handleBulkCategoryUpdate(bulkCategoryChange);
                    setBulkCategoryChange('');
                  }
                }}
                style={{ padding: '6px 10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
              >
                Apply
              </button>
            </div>

            {/* Bulk Price Adjust */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary, #1F2937)' }}>Adjust Price %:</label>
              <select 
                onChange={(e) => {
                  if(e.target.value) {
                    handleBulkPriceAdjust(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light, #D9E1E7)', fontSize: '12px' }}
              >
                <option value="">Select...</option>
                <option value="10">+10%</option>
                <option value="5">+5%</option>
                <option value="-5">-5%</option>
                <option value="-10">-10%</option>
              </select>
            </div>

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

      {/* Header Tabs and Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '12px', padding: '6px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              background: activeTab === 'all' ? '#fff' : 'transparent', 
              fontWeight: '600', 
              color: activeTab === 'all' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            All Products <span style={{ background: activeTab === 'all' ? '#e2e8f0' : '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '6px' }}>{products.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('reorder')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              background: activeTab === 'reorder' ? '#fff' : 'transparent', 
              fontWeight: '600', 
              color: activeTab === 'reorder' ? '#dc2626' : '#64748b',
              boxShadow: activeTab === 'reorder' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Reorder List <span style={{ background: activeTab === 'reorder' ? '#fee2e2' : '#f1f5f9', color: activeTab === 'reorder' ? '#b91c1c' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{reorderList.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('expiry')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              background: activeTab === 'expiry' ? '#fff' : 'transparent', 
              fontWeight: '600', 
              color: activeTab === 'expiry' ? '#d97706' : '#64748b',
              boxShadow: activeTab === 'expiry' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⏳ Expiry Management <span style={{ background: activeTab === 'expiry' ? '#fef3c7' : '#f1f5f9', color: activeTab === 'expiry' ? '#b45309' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{expiryBatches.length}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowBulkImport(true)}
            style={{ padding: '10px 16px', background: 'var(--secondary, #17324D)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            📥 Bulk Import Excel
          </button>

          <button 
            onClick={() => {
              if (products.length > 0) {
                setBatchForm(prev => ({
                  ...prev,
                  productId: products[0]._id,
                  vendorId: vendors[0]?._id || '',
                  branchId: branches[0]?._id || ''
                }));
              }
              setShowAddBatchModal(true);
            }}
            style={{ padding: '10px 16px', background: 'var(--border-subtle, #F1F5F9)', color: 'var(--text-primary, #1F2937)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            🏷️ Register Batch
          </button>

          <button 
            onClick={() => {
              setRemainingSeconds(alertSettings.displayTimeSeconds || 10);
              setTimerPaused(false);
              setShowAlertPopup(true);
            }}
            style={{ 
              padding: '10px 14px', 
              background: lowStockProducts.length > 0 ? '#fef2f2' : '#f8fafc', 
              color: lowStockProducts.length > 0 ? '#dc2626' : '#475569', 
              border: `1px solid ${lowStockProducts.length > 0 ? '#fca5a5' : '#cbd5e1'}`, 
              borderRadius: 'var(--radius-md, 8px)', 
              fontWeight: '600', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '13px'
            }}
          >
            🔔 Stock Alerts <span style={{ background: lowStockProducts.length > 0 ? '#ef4444' : '#cbd5e1', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{lowStockProducts.length}</span>
          </button>

          <button 
            onClick={() => setShowAdd(true)}
            style={{ padding: '10px 18px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            ➕ Register Product
          </button>
        </div>
      </div>

      {/* Expiry Management View */}
      {activeTab === 'expiry' ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg, 10px)', padding: '20px', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Batch Expiry Tracking</h3>
            
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Batches' },
                { id: 'expired', label: 'Expired', color: '#ef4444', bg: '#fef2f2' },
                { id: '7days', label: '7 Days', color: '#ea580c', bg: '#fff7ed' },
                { id: '15days', label: '15 Days', color: '#ca8a04', bg: '#fefce8' },
                { id: '30days', label: '30 Days', color: 'var(--primary, #087E8B)', bg: 'var(--primary-light, #E8F5F6)' }
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setExpiryCategoryFilter(pill.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: expiryCategoryFilter === pill.id ? '2px solid var(--primary, #087E8B)' : '1px solid var(--border-light, #D9E1E7)',
                    background: expiryCategoryFilter === pill.id ? (pill.bg || 'var(--primary-light, #E8F5F6)') : '#fff',
                    color: expiryCategoryFilter === pill.id ? (pill.color || 'var(--primary, #087E8B)') : '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light, #D9E1E7)', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>Product Name</th>
                  <th style={{ padding: '10px 14px' }}>Batch Number</th>
                  <th style={{ padding: '10px 14px' }}>Expiry Date</th>
                  <th style={{ padding: '10px 14px' }}>Remaining Days</th>
                  <th style={{ padding: '10px 14px' }}>Stock Qty</th>
                  <th style={{ padding: '10px 14px' }}>Supplier</th>
                  <th style={{ padding: '10px 14px' }}>Expiry Badge</th>
                </tr>
              </thead>
              <tbody>
                {expiryBatches
                  .filter(b => {
                    if (expiryCategoryFilter === 'all') return true;
                    if (b.remainingDays === null || b.remainingDays === undefined) return false;
                    if (expiryCategoryFilter === 'expired') return b.remainingDays < 0;
                    if (expiryCategoryFilter === '7days') return b.remainingDays >= 0 && b.remainingDays <= 7;
                    if (expiryCategoryFilter === '15days') return b.remainingDays >= 0 && b.remainingDays <= 15;
                    if (expiryCategoryFilter === '30days') return b.remainingDays >= 0 && b.remainingDays <= 30;
                    return true;
                  })
                  .map((batch, idx) => {
                    const rem = batch.remainingDays;
                    let badgeBg = '#f1f5f9';
                    let badgeColor = '#475569';
                    let badgeText = 'Valid';

                    if (rem !== null && rem !== undefined) {
                      if (rem < 0) {
                        badgeBg = '#fef2f2'; badgeColor = '#dc2626'; badgeText = 'EXPIRED';
                      } else if (rem <= 7) {
                        badgeBg = '#fff7ed'; badgeColor = '#ea580c'; badgeText = '7 Days Warning';
                      } else if (rem <= 15) {
                        badgeBg = '#fefce8'; badgeColor = '#ca8a04'; badgeText = '15 Days Warning';
                      } else if (rem <= 30) {
                        badgeBg = 'var(--primary-light, #E8F5F6)'; badgeColor = 'var(--primary, #087E8B)'; badgeText = '30 Days Warning';
                      }
                    }

                    return (
                      <tr key={batch._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>
                          {batch.product?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#334155' }}>
                          {batch.batchNumber}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: rem < 0 ? '#dc2626' : rem <= 30 ? '#d97706' : '#166534' }}>
                          {rem !== null && rem !== undefined ? `${rem} days` : 'No date'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                          {batch.quantity} {batch.product?.unit || 'units'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {batch.vendor?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                            backgroundColor: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}40`
                          }}>
                            {badgeText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {expiryBatches.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No product batches registered yet. Click "Register Batch" to add batch expiry tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      /* Products Directory Grid */
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {activeProducts.map((prod, idx) => (
          <div key={prod._id} style={{ 
            background: '#fff', 
            border: '1px solid var(--border-light, #D9E1E7)', 
            borderRadius: 'var(--radius-lg, 10px)', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
          }}>
            
            {/* Selection Checkbox */}
            <input 
              type="checkbox"
              checked={selectedIds.includes(prod._id)}
              onChange={() => handleSelectRow(prod._id)}
              style={{ position: 'absolute', top: '16px', left: '16px', width: '18px', height: '18px', cursor: 'pointer', zIndex: 10 }}
            />

            <span style={{ position: 'absolute', top: '16px', left: '42px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>#{idx + 1}</span>

            {/* Low stock tag */}
            {prod.currentStock <= prod.lowStockThreshold && (
              <span style={{ position: 'absolute', top: '16px', right: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '11px', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444'}}></span> LOW STOCK
              </span>
            )}

            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>{prod.name}</h4>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>{prod.category}</span>
                <span>HSN: {prod.hsnCode || 'N/A'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light, #D9E1E7)' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Stock Status</span>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: (prod.currentStock - (prod.reservedStock || 0)) <= prod.lowStockThreshold ? '#dc2626' : '#0f172a' }}>
                  {Math.max(0, prod.currentStock - (prod.reservedStock || 0))} <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>Available</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Total: {prod.currentStock} {prod.unit} {prod.reservedStock > 0 && <span style={{ color: '#d97706', fontWeight: 'bold' }}>(🔒 {prod.reservedStock} Reserved)</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-light, #D9E1E7)', paddingLeft: '14px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Retail Price</span>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--primary, #087E8B)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Rs.</span> {prod.price.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light, #D9E1E7)' }}>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    setOrderingProduct(prod);
                    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
                    setOrderForm({ quantity: Math.max(10, prod.lowStockThreshold), expectedDeliveryDate: tmrw.toISOString().split('T')[0] });
                  }}
                  style={{ padding: '8px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md, 8px)', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
                  title="Quick Order"
                >
                  Order
                </button>
                <button 
                  onClick={() => {
                    setAdjustingProduct(prod);
                    setAdjustForm({ newQty: prod.currentStock, reason: 'recount' });
                  }}
                  style={{ padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  title="Adjust Stock"
                >
                  Adjust
                </button>
                <button 
                  onClick={() => handleViewLogs(prod)}
                  style={{ padding: '8px 12px', background: 'var(--primary-light, #E8F5F6)', color: 'var(--primary, #087E8B)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-md, 8px)', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle, #F1F5F9)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-light, #E8F5F6)'}
                  title="View Logs"
                >
                  Logs
                </button>
                <button 
                  onClick={() => handleDeleteProduct(prod._id)}
                  style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 'var(--radius-md, 8px)', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                  title="Delete Product"
                >
                  Delete
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>
      )}

      {/* Product CRUD Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px 14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Register Product</h3>
              <button 
                type="button" 
                onClick={() => setShowAdd(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Product Name*</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.name ? '#ef4444' : '#cbd5e1'}` }}
                  />
                  {formErrors.name && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.name}</span>}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Category*</label>
                    <input 
                      type="text"
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({ ...formData, category: e.target.value });
                        if (formErrors.category) setFormErrors({ ...formErrors, category: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.category ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.category && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.category}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>HSN Code*</label>
                    <input 
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => {
                        setFormData({ ...formData, hsnCode: e.target.value });
                        if (formErrors.hsnCode) setFormErrors({ ...formErrors, hsnCode: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.hsnCode ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.hsnCode && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.hsnCode}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Unit (e.g. strips)*</label>
                    <input 
                      type="text"
                      value={formData.unit}
                      onChange={(e) => {
                        setFormData({ ...formData, unit: e.target.value });
                        if (formErrors.unit) setFormErrors({ ...formErrors, unit: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.unit ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.unit && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.unit}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Retail Price (Rs.)*</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => {
                        setFormData({ ...formData, price: e.target.value });
                        if (formErrors.price) setFormErrors({ ...formErrors, price: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.price ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.price && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.price}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Purchase Price (Rs.)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => {
                        setFormData({ ...formData, purchasePrice: e.target.value });
                        if (formErrors.purchasePrice) setFormErrors({ ...formErrors, purchasePrice: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.purchasePrice ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.purchasePrice && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.purchasePrice}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Initial Stock*</label>
                    <input 
                      type="number"
                      value={formData.currentStock}
                      onChange={(e) => {
                        setFormData({ ...formData, currentStock: e.target.value });
                        if (formErrors.currentStock) setFormErrors({ ...formErrors, currentStock: '' });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.currentStock ? '#ef4444' : '#cbd5e1'}` }}
                    />
                    {formErrors.currentStock && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.currentStock}</span>}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Reorder Level*</label>
                  <input 
                    type="number"
                    value={formData.lowStockThreshold}
                    onChange={(e) => {
                      setFormData({ ...formData, lowStockThreshold: e.target.value });
                      if (formErrors.lowStockThreshold) setFormErrors({ ...formErrors, lowStockThreshold: '' });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.lowStockThreshold ? '#ef4444' : '#cbd5e1'}` }}
                  />
                  {formErrors.lowStockThreshold && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.lowStockThreshold}</span>}
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Supplier Vendor*</label>
                  <select 
                    value={formData.linkedVendor} 
                    onChange={(e) => {
                      setFormData({ ...formData, linkedVendor: e.target.value });
                      if (formErrors.linkedVendor) setFormErrors({ ...formErrors, linkedVendor: '' });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.linkedVendor ? '#ef4444' : '#cbd5e1'}`, background: '#fff' }}
                  >
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.name}</option>
                    ))}
                  </select>
                  {formErrors.linkedVendor && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.linkedVendor}</span>}
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Branch (Optional)</label>
                  <select 
                    value={formData.branchId} 
                    onChange={(e) => {
                      setFormData({ ...formData, branchId: e.target.value });
                      if (formErrors.branchId) setFormErrors({ ...formErrors, branchId: '' });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.branchId ? '#ef4444' : '#cbd5e1'}`, background: '#fff' }}
                  >
                    <option value="">Default Branch (Auto-assigned)</option>
                    {branches.map(br => (
                      <option key={br._id} value={br._id}>{br.name}</option>
                    ))}
                  </select>
                  {formErrors.branchId && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.branchId}</span>}
                </div>

                {/* Expiry Tracking Config */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={formData.hasExpiryTracking}
                      onChange={(e) => setFormData({ ...formData, hasExpiryTracking: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Enable Expiry Tracking for this Product
                  </label>
                  {formData.hasExpiryTracking && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--primary, #087E8B)', background: 'var(--primary-light, #E8F5F6)', padding: '6px 10px', borderRadius: '6px', fontWeight: 500 }}>
                      💡 <strong>Expiry Managed Through Batch</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px 24px 18px 24px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: '10px', flexShrink: 0 }}>
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
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Adjust Stock</h3>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '15px' }}>Product: {adjustingProduct.name}</span>
            
            <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>New Quantity Level*</label>
                <input 
                  type="number"
                  value={adjustForm.newQty}
                  onChange={(e) => setAdjustForm({ ...adjustForm, newQty: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Adjustment Reason*</label>
                <select 
                  value={adjustForm.reason} 
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="recount">Recount Audit Correction</option>
                  <option value="damage">Damaged Inventory</option>
                  <option value="loss">Loss / Theft</option>
                  <option value="return">Returned Stock</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setAdjustingProduct(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Logs Modal */}
      {showLogsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>Stock Movements Log</h3>
              <button onClick={() => setShowLogsModal(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <span style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '15px', fontWeight: '600' }}>Product: {showLogsModal.name}</span>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Timestamp</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Movement</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Source / Reason</th>
                </tr>
              </thead>
              <tbody>
                {selectedProductLogs.length > 0 ? (
                  selectedProductLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 'bold', color: log.type === 'in' ? '#166534' : '#b91c1c' }}>
                        {log.type === 'in' ? '➕ Stock In' : '➖ Stock Out'} ({log.quantity} units)
                      </td>
                      <td style={{ padding: '8px 10px', textTransform: 'capitalize', color: '#475569' }}>{log.reason}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ padding: '20px', textLight: 'center', color: '#94a3b8' }}>No stock movement logs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Purchase Order Modal */}
      {orderingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
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

      {/* Interactive Stock Alert Popup Modal with Admin Timer */}
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
                    setActiveTab('reorder');
                  }}
                  style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  📦 View Reorder List
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
                  id="auto-show-popup-check"
                  checked={tempSettings.autoShowPopup}
                  onChange={(e) => setTempSettings({ ...tempSettings, autoShowPopup: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="auto-show-popup-check" style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}>
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
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Save Settings
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Batch Registration Modal */}
      {showAddBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Register Product Batch</h3>
            
            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Select Product*</label>
                <select
                  value={batchForm.productId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const selectedP = products.find(p => p._id === pid);
                    setBatchForm({
                      ...batchForm,
                      productId: pid,
                      purchasePrice: selectedP ? selectedP.purchasePrice || '' : '',
                      retailPrice: selectedP ? selectedP.price || '' : ''
                    });
                    if (batchErrors.productId) setBatchErrors({ ...batchErrors, productId: '' });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${batchErrors.productId ? '#ef4444' : '#cbd5e1'}`, background: '#fff' }}
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.category})</option>
                  ))}
                </select>
                {batchErrors.productId && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{batchErrors.productId}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Batch Number*</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-001"
                  value={batchForm.batchNumber}
                  onChange={(e) => {
                    setBatchForm({ ...batchForm, batchNumber: e.target.value });
                    if (batchErrors.batchNumber) setBatchErrors({ ...batchErrors, batchNumber: '' });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${batchErrors.batchNumber ? '#ef4444' : '#cbd5e1'}` }}
                />
                {batchErrors.batchNumber && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{batchErrors.batchNumber}</span>}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Expiry Date</label>
                  <input
                    type="date"
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Manufacturing Date</label>
                  <input
                    type="date"
                    value={batchForm.mfgDate}
                    onChange={(e) => setBatchForm({ ...batchForm, mfgDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Quantity (Units)*</label>
                  <input
                    type="number"
                    value={batchForm.quantity}
                    onChange={(e) => {
                      setBatchForm({ ...batchForm, quantity: e.target.value });
                      if (batchErrors.quantity) setBatchErrors({ ...batchErrors, quantity: '' });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${batchErrors.quantity ? '#ef4444' : '#cbd5e1'}` }}
                  />
                  {batchErrors.quantity && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{batchErrors.quantity}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Purchase Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={batchForm.purchasePrice}
                    onChange={(e) => setBatchForm({ ...batchForm, purchasePrice: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        type="products"
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => {
          fetchData();
          setToast({ type: 'success', message: 'Products imported successfully! ✅' });
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
