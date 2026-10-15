import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function CustomerOrderBook({ user, onNavigate }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // { productId: quantity }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [deliveryDate, setDeliveryDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState(30);

  useEffect(() => {
    fetchProducts();
    // Default delivery date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDeliveryDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load products catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => setSearch(e.target.value);

  const updateQuantity = (productId, delta) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[productId];
      } else {
        newCart[productId] = next;
      }
      return newCart;
    });
  };

  const calculateTotal = () => {
    let total = 0;
    Object.keys(cart).forEach(id => {
      const p = products.find(prod => prod._id === id);
      if (p) {
        total += p.price * cart[id];
      }
    });
    return total;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckout = async () => {
    setError('');
    setSuccess('');

    if (Object.keys(cart).length === 0) {
      setError('Your cart is empty');
      return;
    }

    if (!deliveryDate) {
      setError('Please select a delivery date');
      return;
    }

    const items = Object.keys(cart).map(id => ({
      product: id,
      quantity: cart[id]
    }));

    setSubmitting(true);
    try {
      // The backend uses req.user.id for customer when role is Customer
      await api.post('/orders', {
        items,
        deliveryDate,
        isRecurring,
        recurringIntervalDays: isRecurring ? recurringDays : 30
      });
      setSuccess('Order placed successfully! We will process it shortly.');
      setCart({});
      
      // Clear success message after 3 seconds and go back to dashboard
      setTimeout(() => {
        onNavigate('customer_dashboard');
      }, 3000);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      {/* Product Catalog */}
      <div style={{ flex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>Product Catalog</h2>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={search}
            onChange={handleSearch}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '250px', outline: 'none' }}
          />
        </div>

        {loading ? (
          <div>Loading catalog...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {filteredProducts.map((p, idx) => (
              <div key={p._id} style={{ background: 'var(--bg-card, #FFFFFF)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', padding: '15px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '5px' }}>#{idx + 1} - {p.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', marginBottom: '10px' }}>{p.category}</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981', marginBottom: '15px' }}>Rs. {p.price.toFixed(2)}</div>
                
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {cart[p._id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f1f5f9', borderRadius: '6px', padding: '4px' }}>
                      <button 
                        onClick={() => updateQuantity(p._id, -1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#fff', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
                      >-</button>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{cart[p._id]}</span>
                      <button 
                        onClick={() => updateQuantity(p._id, 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#fff', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}
                      >+</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => updateQuantity(p._id, 1)}
                      style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md, 8px)', border: 'none', background: 'var(--primary, #087E8B)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && <div style={{ color: '#64748b' }}>No products found.</div>}
          </div>
        )}
      </div>

      {/* Cart Checkout */}
      <div style={{ flex: 1, minWidth: '300px', background: 'var(--bg-card, #FFFFFF)', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', padding: '20px', position: 'sticky', top: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '20px', borderBottom: '1px solid var(--border-light, #D9E1E7)', paddingBottom: '10px' }}>Your Order</h3>
        
        {Object.keys(cart).length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Your cart is empty</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            {Object.keys(cart).map(id => {
              const p = products.find(prod => prod._id === id);
              if (!p) return null;
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <div>
                    <div style={{ color: '#334155', fontWeight: '500' }}>{p.name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{cart[id]} x Rs. {p.price.toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Rs. {(cart[id] * p.price).toFixed(2)}</div>
                </div>
              );
            })}
            
            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>Total Amount</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary, #087E8B)' }}>Rs. {calculateTotal().toFixed(2)}</div>
            </div>
          </div>
        )}

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px' }}>{error}</div>}
        {success && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px' }}>{success}</div>}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Required Delivery Date</label>
          <input 
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isRecurring} 
              onChange={(e) => setIsRecurring(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
            Make this a Recurring Order
          </label>
          
          {isRecurring && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Deliver every (days):</label>
              <input 
                type="number"
                min="1"
                value={recurringDays}
                onChange={(e) => setRecurringDays(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
          )}
        </div>

        <button 
          onClick={handleCheckout}
          disabled={Object.keys(cart).length === 0 || submitting}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: Object.keys(cart).length === 0 || submitting ? '#94a3b8' : '#10b981', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            fontWeight: 'bold', 
            fontSize: '15px',
            cursor: Object.keys(cart).length === 0 || submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {submitting ? 'Processing...' : 'Place Order Now'}
        </button>
      </div>
    </div>
  );
}
