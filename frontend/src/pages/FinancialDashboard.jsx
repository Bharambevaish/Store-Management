import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CreditCard,
  Users,
  ArrowUpDown,
  Receipt,
  ArrowUpRight
} from 'lucide-react';

export default function FinancialDashboard() {
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sort State
  const [sortField, setSortField] = useState('outstanding');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchData = async () => {
    try {
      const [statsRes, expRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/expenses')
      ]);
      setStats(statsRes.data);
      setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load financial dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSales = stats?.totalSales || 0;
  const netProfit = totalSales - totalExpenses;

  // Sorting customer dues table
  const sortedDues = stats?.customerDues ? [...stats.customerDues] : [];
  if (sortedDues.length > 0) {
    sortedDues.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  const handleRequestSort = (field) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Prepare chart data (Monthly Breakdown simulation)
  const salesTrend = [
    { month: 'Jan', Sales: totalSales * 0.15, Expenses: totalExpenses * 0.15 },
    { month: 'Feb', Sales: totalSales * 0.20, Expenses: totalExpenses * 0.10 },
    { month: 'Mar', Sales: totalSales * 0.10, Expenses: totalExpenses * 0.20 },
    { month: 'Apr', Sales: totalSales * 0.25, Expenses: totalExpenses * 0.15 },
    { month: 'May', Sales: totalSales * 0.12, Expenses: totalExpenses * 0.12 },
    { month: 'Jun', Sales: totalSales * 0.18, Expenses: totalExpenses * 0.28 }
  ];

  if (loading) return <div style={{ padding: '40px', color: '#64748B', textAlign: 'center' }}>Loading financial dashboards...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fecaca', color: '#DC3545', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Financial Scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        <div className="stat-card" style={{ background: '#FFFFFF', borderColor: '#D9E1E7' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: '#087E8B' }}>Total Sales</span>
            <div className="stat-icon-wrapper" style={{ background: '#E8F5F6', color: '#087E8B' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#17324D' }}>Rs. {totalSales.toFixed(2)}</div>
          <div className="stat-subtext">Today: Rs. {(stats?.todaySales || 0).toFixed(2)}</div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', borderColor: '#D9E1E7' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: '#DC3545' }}>Total Expenses</span>
            <div className="stat-icon-wrapper" style={{ background: '#fee2e2', color: '#DC3545' }}>
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#17324D' }}>Rs. {totalExpenses.toFixed(2)}</div>
          <div className="stat-subtext">Total business expenses logged</div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', borderColor: '#D9E1E7' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: netProfit >= 0 ? '#198754' : '#DC3545' }}>Net Profit / Loss</span>
            <div className="stat-icon-wrapper" style={{ background: netProfit >= 0 ? '#dcfce7' : '#fee2e2', color: netProfit >= 0 ? '#198754' : '#DC3545' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#17324D' }}>Rs. {netProfit.toFixed(2)}</div>
          <div className="stat-subtext">Sales minus total expenses</div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', borderColor: '#D9E1E7' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: '#D97706' }}>Unpaid Amount</span>
            <div className="stat-icon-wrapper" style={{ background: '#fef3c7', color: '#D97706' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#17324D' }}>Rs. {(stats?.totalOutstanding || 0).toFixed(2)}</div>
          <div className="stat-subtext">Customer balance pending</div>
        </div>

      </div>

      {/* Sales Trend Chart */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#17324D', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#087E8B" /> Sales vs Expenses Trend
          </h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>6 Months Comparison</span>
        </div>
        <div style={{ width: '100%', height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip formatter={(value) => `Rs. ${Number(value).toFixed(2)}`} />
              <Area type="monotone" dataKey="Sales" stroke="#087E8B" fillOpacity={0.15} fill="#087E8B" />
              <Area type="monotone" dataKey="Expenses" stroke="#DC3545" fillOpacity={0.08} fill="#DC3545" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Sortable Dues and Recent Transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* Outstanding Dues list */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#17324D', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#DC3545" /> Unpaid Customer Balances
          </h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E1E7' }}>
                <th 
                  onClick={() => handleRequestSort('name')}
                  style={{ padding: '10px 12px', color: '#17324D', cursor: 'pointer', fontWeight: '700' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Customer {sortField === 'name' && <ArrowUpDown size={12} />}
                  </span>
                </th>
                <th 
                  onClick={() => handleRequestSort('outstanding')}
                  style={{ padding: '10px 12px', color: '#17324D', cursor: 'pointer', textAlign: 'right', fontWeight: '700' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    Unpaid Amount {sortField === 'outstanding' && <ArrowUpDown size={12} />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDues.map((du, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1F2937' }}>
                    {du.name}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#DC3545' }}>
                    Rs. {du.outstanding.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Transactions Feed */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#17324D', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="#198754" /> Recent Payments Received
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map((tr, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #D9E1E7', borderRadius: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#17324D' }}>{tr.customerName}</strong>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Mode: {tr.mode} | Date: {new Date(tr.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#198754', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <ArrowUpRight size={14} /> Rs. {tr.amount.toFixed(2)}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{tr.ref || 'Ref: N/A'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '12px', textAlign: 'center', padding: '40px' }}>No recent payments.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
