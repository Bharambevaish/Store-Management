import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function PublicTracking() {
  const [orderId, setOrderId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Extract ID from path like /track/12345
    const pathParts = window.location.pathname.split('/');
    const idIndex = pathParts.indexOf('track');
    if (idIndex !== -1 && pathParts.length > idIndex + 1) {
      const id = pathParts[idIndex + 1];
      setOrderId(id);
      fetchTrackingData(id);
    } else {
      setError('Invalid tracking URL.');
      setLoading(false);
    }
  }, []);

  const fetchTrackingData = async (id) => {
    try {
      const res = await api.get(`/track/${id}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Order not found or tracking unavailable.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading tracking information...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#b91c1c' }}>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'var(--status-warning, #D97706)';
      case 'Assigned': return 'var(--primary, #087E8B)';
      case 'Packed': return 'var(--secondary, #17324D)';
      case 'Out for Delivery': return 'var(--status-warning, #D97706)';
      case 'Delivered': return 'var(--status-success, #198754)';
      case 'Cancelled': return 'var(--status-danger, #DC3545)';
      default: return 'var(--text-muted, #94A3B8)';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main, #F6F8FA)', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--bg-card, #FFFFFF)', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '30px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-light, #D9E1E7)', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '5px' }}>Delivery Tracking</h1>
          <p style={{ color: 'var(--text-secondary, #64748B)' }}>Order ID: {data.id.substring(18).toUpperCase()}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)' }}>Customer</div>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>{data.customer}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)' }}>Expected Delivery</div>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>{new Date(data.deliveryDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ padding: '15px', background: 'var(--bg-main, #F6F8FA)', borderRadius: 'var(--radius-md, 8px)', marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Current Status:</div>
          <div style={{ padding: '6px 16px', borderRadius: '20px', background: getStatusColor(data.status), color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
            {data.status}
          </div>
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '15px' }}>Tracking History</h3>
        <div style={{ marginLeft: '10px', borderLeft: '2px solid var(--border-light, #D9E1E7)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {data.statusHistory && data.statusHistory.map((h, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-27px', top: '0', width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(h.status), border: '2px solid #fff' }}></div>
              <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', fontSize: '14px' }}>{h.status}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)' }}>{new Date(h.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {(data.latitude !== 0 && data.longitude !== 0 && data.status === 'Out for Delivery') && (
          <div style={{ marginTop: '30px', padding: '15px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '10px' }}>Live Location</h3>
            <div style={{ height: '200px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight="0" 
                marginWidth="0" 
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(data.longitude)-0.005},${Number(data.latitude)-0.005},${Number(data.longitude)+0.005},${Number(data.latitude)+0.005}&layer=mapnik&marker=${Number(data.latitude)},${Number(data.longitude)}`}
              ></iframe>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
