import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function CustomerDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In future phases, we will fetch specific dashboard data for the customer
    api.get('/auth/me')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading Customer Portal...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '24px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)', marginBottom: '10px' }}>Welcome back, {user?.name}!</h2>
        <p style={{ color: 'var(--text-secondary, #64748B)' }}>This is your customer portal. Here you can track orders, view invoices, and make payments online.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '20px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', marginBottom: '10px' }}>Your Outstanding Balance</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--status-danger, #DC3545)' }}>Rs. 0.00</div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '10px' }}>No pending invoices.</p>
        </div>

        <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '20px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', marginBottom: '10px' }}>Active Orders</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--status-success, #198754)' }}>0</div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '10px' }}>Currently processing or out for delivery.</p>
        </div>
      </div>
      
      {/* We will build the rest of this page out during the Online Order Booking task */}
    </div>
  );
}
