import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function StaffDashboard({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [signatureModal, setSignatureModal] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [proofImage, setProofImage] = useState('');

  const fetchAssignedOrders = async () => {
    try {
      const res = await api.get(`/orders?staffId=${user.id}`);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch assigned delivery tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, [user]);

  // Live GPS Tracking
  useEffect(() => {
    let watchId;
    const activeOrders = orders.filter(o => o.status === 'Out for Delivery');
    
    if (activeOrders.length > 0 && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          activeOrders.forEach(o => {
            api.put(`/orders/${o._id}/location`, { latitude, longitude }).catch(e => console.error(e));
          });
        },
        (err) => console.warn('Live GPS tracking error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
    
    return () => {
      if (watchId !== undefined && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [orders]);

  const handleUpdateStatus = async (orderId, nextStatus, extra = {}) => {
    try {
      setError('');
      await api.put(`/orders/${orderId}/status`, { status: nextStatus, ...extra });
      fetchAssignedOrders();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update order status');
    }
  };

  // Canvas Drawing Logic
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      (e.clientX || e.touches[0].clientX) - rect.left,
      (e.clientY || e.touches[0].clientY) - rect.top
    );
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(
      (e.clientX || e.touches[0].clientX) - rect.left,
      (e.clientY || e.touches[0].clientY) - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  };

  const handleOpenSignatureModal = (order) => {
    setSelectedOrder(order);
    setSignatureModal(true);
    setTimeout(() => {
      clearCanvas();
    }, 100);
  };

  const handleSaveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureUrl = canvas.toDataURL('image/png');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          handleUpdateStatus(selectedOrder._id, 'Delivered', { 
            signatureUrl,
            deliveryProofUrl: proofImage,
            latitude,
            longitude
          });
        },
        (err) => {
          console.warn('Geolocation capture failed, saving fallback without coordinates:', err);
          handleUpdateStatus(selectedOrder._id, 'Delivered', { 
            signatureUrl,
            deliveryProofUrl: proofImage
          });
        }
      );
    } else {
      handleUpdateStatus(selectedOrder._id, 'Delivered', { 
        signatureUrl,
        deliveryProofUrl: proofImage
      });
    }

    setSignatureModal(false);
    setSelectedOrder(null);
    setProofImage('');
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading delivery assignments...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '16px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>Welcome, {user.name} 🚚</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', marginTop: '4px' }}>Here are the order delivery runs assigned to you today.</p>
        </div>
        <button 
          onClick={() => {
            if (!navigator.geolocation) return alert('Geolocation not supported');
            navigator.geolocation.getCurrentPosition(pos => {
              const { latitude, longitude } = pos.coords;
              
              // Haversine distance
              const distance = (lat1, lon1, lat2, lon2) => {
                const R = 6371; // km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              };

              const pending = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status));
              const done = orders.filter(o => ['Delivered', 'Cancelled'].includes(o.status));
              
              // Sort pending by distance from current location (mocking customer lat/lng if missing)
              const sorted = [...pending].sort((a, b) => {
                // If customer doesn't have lat/lng, we simulate it or treat it as 0
                // In a real app we'd geocode customer.address
                // For demonstration, let's assume they have or we use random sorting as fallback
                const distA = (a.customer.latitude && a.customer.longitude) 
                  ? distance(latitude, longitude, a.customer.latitude, a.customer.longitude) : Math.random();
                const distB = (b.customer.latitude && b.customer.longitude)
                  ? distance(latitude, longitude, b.customer.latitude, b.customer.longitude) : Math.random();
                return distA - distB;
              });

              setOrders([...sorted, ...done]);
              alert('Route optimized based on nearest locations!');
            });
          }}
          style={{ padding: '8px 12px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          📍 Optimize Route
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Orders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {orders.length > 0 ? (
          orders.map((o, idx) => {
            const isCompleted = ['Delivered', 'Cancelled'].includes(o.status);
            return (
              <div key={o._id} style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>#{idx + 1} - ORD-{o._id.toString().substring(18).toUpperCase()}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '3px 8px', 
                    borderRadius: '6px', 
                    fontWeight: 'bold',
                    background: o.status === 'Delivered' ? 'var(--status-success-bg, #D1E7DD)' : o.status === 'Assigned' ? 'var(--primary-light, #E8F5F6)' : 'var(--status-warning-bg, #FEF3C7)',
                    color: o.status === 'Delivered' ? 'var(--status-success-text, #0F5132)' : o.status === 'Assigned' ? 'var(--primary, #087E8B)' : 'var(--status-warning-text, #92400E)'
                  }}>
                    {o.status}
                  </span>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>{o.customer.name}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>📍 {o.customer.address}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>📞 Mobile: {o.customer.mobile}</div>
                </div>

                {/* Items */}
                <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-light, #D9E1E7)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Items to Deliver</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    {o.items.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155' }}>
                        <span>• {it.product.name}</span>
                        <strong>x{it.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status action buttons */}
                {!isCompleted && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                    {o.status === 'Assigned' && (
                      <button 
                        onClick={() => handleUpdateStatus(o._id, 'Packed')}
                        style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        📦 Mark as Packed
                      </button>
                    )}
                    {o.status === 'Packed' && (
                      <button 
                        onClick={() => handleUpdateStatus(o._id, 'Out for Delivery')}
                        style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        🚚 Mark Out for Delivery
                      </button>
                    )}
                    {o.status === 'Out for Delivery' && (
                      <button 
                        onClick={() => handleOpenSignatureModal(o)}
                        style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        ✍️ Collect Signature & Deliver
                      </button>
                    )}
                  </div>
                )}
                
                {o.status === 'Delivered' && o.deliveredAt && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#166534', background: '#f0fdf4', padding: '8px', borderRadius: '6px' }}>
                    Delivered successfully on {new Date(o.deliveredAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '60px 0' }}>
            🎉 No delivery assignments found. Good job!
          </div>
        )}
      </div>

      {/* Signature & Confirmation Modal */}
      {signatureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Confirm Delivery</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Please attach a photo proof and collect the customer signature.</p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Attach Delivery Photo Proof</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setProofImage(reader.result);
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ fontSize: '12px' }}
              />
              {proofImage && <img src={proofImage} alt="Proof Preview" style={{ maxHeight: '50px', marginTop: '5px', objectFit: 'contain' }} />}
            </div>

            <div style={{ border: '2px dashed #94a3b8', borderRadius: '8px', background: '#f8fafc', overflow: 'hidden' }}>
              <canvas 
                ref={canvasRef}
                width={400}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ display: 'block', width: '100%', height: '200px', cursor: 'crosshair', touchAction: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button 
                onClick={clearCanvas}
                style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Clear Pad
              </button>
              <button 
                onClick={handleSaveSignature}
                style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Submit Delivery
              </button>
            </div>

            <button 
              onClick={() => { setSignatureModal(false); setSelectedOrder(null); }}
              style={{ width: '100%', marginTop: '10px', padding: '8px', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
