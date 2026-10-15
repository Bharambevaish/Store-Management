import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter States
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    try {
      let queryParams = [];
      if (selectedUser) queryParams.push(`user=${selectedUser}`);
      if (selectedEntity) queryParams.push(`entity=${selectedEntity}`);
      if (startDate) queryParams.push(`startDate=${startDate}`);
      if (endDate) queryParams.push(`endDate=${endDate}`);

      const queryStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await api.get(`/data/audit-logs${queryStr}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch system audit logs');
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  useEffect(() => {
    const init = async () => {
      await fetchLogs();
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-secondary, #64748B)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: 'var(--danger-light, #F8D7DA)', border: '1px solid var(--danger, #DC3545)', color: 'var(--danger, #DC3545)', borderRadius: 'var(--radius-md, 8px)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Filters Form */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '20px' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>Staff</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', fontSize: '13px' }}
            >
              <option value="">All Staff</option>
              {employees.filter(emp => emp.user).map(emp => (
                <option key={emp.user._id} value={emp.user._id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>Category</label>
            <select 
              value={selectedEntity} 
              onChange={(e) => setSelectedEntity(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', fontSize: '13px' }}
            >
              <option value="">All Categories</option>
              <option value="Customer">Customer</option>
              <option value="Vendor">Supplier</option>
              <option value="Product">Product</option>
              <option value="Order">Order</option>
              <option value="Bill">Bill</option>
              <option value="Payment">Payment</option>
              <option value="Setting">Settings</option>
              <option value="Employee">Staff</option>
              <option value="Expense">Expense</option>
              <option value="PurchaseOrder">Purchase Order</option>
              <option value="ProductStock">Stock Adjustment</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>From Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '7px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', fontSize: '13px' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '5px' }}>To Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '7px 12px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #D9E1E7)', background: 'var(--bg-card, #FFFFFF)', color: 'var(--text-primary, #1F2937)', fontSize: '13px' }} />
            </div>
          </div>

          <button type="submit" style={{ padding: '9px 20px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            Apply Filter
          </button>
        </form>
      </div>

      {/* Logs Table */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main, #F6F8FA)', borderBottom: '1px solid var(--border-light, #D9E1E7)' }}>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Sr. No.</th>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Timestamp</th>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Staff</th>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Action</th>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Category</th>
              <th style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <tr key={log._id} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                  <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontWeight: 'bold' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '12px 20px', fontWeight: '600', color: 'var(--text-primary, #1F2937)' }}>
                    {log.user ? `${log.user.name} (${log.user.email})` : 'System'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-sm, 4px)', 
                      fontWeight: 'bold',
                      background: log.action === 'create' ? 'var(--success-light, #D1E7DD)' : log.action === 'delete' ? 'var(--danger-light, #F8D7DA)' : 'var(--primary-light, #E8F5F6)',
                      color: log.action === 'create' ? 'var(--success, #198754)' : log.action === 'delete' ? 'var(--danger, #DC3545)' : 'var(--primary, #087E8B)',
                      textTransform: 'uppercase'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', color: 'var(--text-primary, #1F2937)' }}>{log.entity}</td>
                  <td style={{ padding: '12px 20px', color: 'var(--text-secondary, #64748B)', fontFamily: 'monospace', fontSize: '11px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.diff}>
                    {log.diff}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>No logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
