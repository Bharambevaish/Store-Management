import React, { useState, useEffect } from 'react';
import api, { AUTH_EXPIRED_EVENT, clearAccessToken } from './services/api.js';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  Building2,
  Package,
  Truck,
  Receipt,
  CreditCard,
  FileText,
  Settings,
  MessageSquare,
  BarChart3,
  ShieldAlert,
  DollarSign,
  LogOut,
  Loader2,
  UserCheck,
  Activity,
  ShoppingBag,
  Home,
  CheckCircle2
} from 'lucide-react';

// Import Pages
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Vendors from './pages/Vendors.jsx';
import Products from './pages/Products.jsx';
import Orders from './pages/Orders.jsx';
import Quotations from './pages/Quotations.jsx';
import Bills from './pages/Bills.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import SettingsPage from './pages/Settings.jsx';

// Advanced Pages
import FinancialDashboard from './pages/FinancialDashboard.jsx';
import Purchases from './pages/Purchases.jsx';
import Expenses from './pages/Expenses.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import CustomerLedgers from './pages/CustomerLedgers.jsx';
import InvoiceGenerator from './pages/InvoiceGenerator.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Multi-branch state
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(localStorage.getItem('selected_branch_id') || '');

  // Authentication is memory-only. Refreshing the page requires a new login,
  // and any credentials left by older builds are removed on startup.
  useEffect(() => {
    clearAccessToken();
    sessionStorage.removeItem('sis_jwt_token');
    sessionStorage.removeItem('sis_user_role');
    sessionStorage.removeItem('sis_user_name');
    localStorage.removeItem('sis_jwt_token');
    localStorage.removeItem('sis_user_role');
    localStorage.removeItem('sis_user_name');
    setUser(null);
    setCheckingAuth(false);

    const handleExpiredAuth = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredAuth);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredAuth);
  }, []);

  // Load branches list on admin login
  useEffect(() => {
    if (user && user.role === 'admin') {
      api.get('/branches')
        .then(res => setBranches(Array.isArray(res.data) ? res.data : []))
        .catch(err => console.error('Failed to load branches:', err));
    }
  }, [user]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    clearAccessToken();
    sessionStorage.removeItem('sis_jwt_token');
    sessionStorage.removeItem('sis_user_role');
    sessionStorage.removeItem('sis_user_name');
    localStorage.removeItem('sis_jwt_token');
    localStorage.removeItem('sis_user_role');
    localStorage.removeItem('sis_user_name');
    setUser(null);
  };

  const handleBranchChange = (e) => {
    const val = e.target.value;
    setSelectedBranch(val);
    localStorage.setItem('selected_branch_id', val);
    window.location.reload();
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#F6F8FA', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 size={36} color="#087E8B" className="animate-spin" />
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Authenticating user session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render Sidebar based on user role
  const renderSidebar = () => {
    if (user.role === 'admin') {
      return (
        <aside className="sidebar no-print">
          <div className="sidebar-header">
            <div className="logo-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="2" y="18" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="800" fill="white">NE</text>
              </svg>
            </div>
            <div>
              <div className="sidebar-title">NARESH ENTERPRISES</div>
              <div className="sidebar-subtitle">Distribution Management ERP</div>
            </div>
          </div>

          <div className="sidebar-menu">
            <div className="sidebar-section-label">Overview</div>
            <div className={`menu-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>
              <span className="menu-icon"><LayoutDashboard size={18} /></span> Dashboard
            </div>
            <div className={`menu-item ${activePage === 'financial_dashboard' ? 'active' : ''}`} onClick={() => setActivePage('financial_dashboard')}>
              <span className="menu-icon"><TrendingUp size={18} /></span> Sales Dashboard
            </div>

            <div className="sidebar-section-label">Parties & People</div>
            <div className={`menu-item ${activePage === 'customers' ? 'active' : ''}`} onClick={() => setActivePage('customers')}>
              <span className="menu-icon"><Users size={18} /></span> Customers
            </div>
            <div className={`menu-item ${activePage === 'customer_ledgers' ? 'active' : ''}`} onClick={() => setActivePage('customer_ledgers')}>
              <span className="menu-icon"><BookOpen size={18} /></span> Customer Ledgers
            </div>
            <div className={`menu-item ${activePage === 'vendors' ? 'active' : ''}`} onClick={() => setActivePage('vendors')}>
              <span className="menu-icon"><Building2 size={18} /></span> Suppliers
            </div>

            <div className="sidebar-section-label">Inventory & Logistics</div>
            <div className={`menu-item ${activePage === 'products' ? 'active' : ''}`} onClick={() => setActivePage('products')}>
              <span className="menu-icon"><Package size={18} /></span> Products
            </div>
            <div className={`menu-item ${activePage === 'purchases' ? 'active' : ''}`} onClick={() => setActivePage('purchases')}>
              <span className="menu-icon"><Truck size={18} /></span> Purchase Orders
            </div>
            <div className={`menu-item ${activePage === 'expenses' ? 'active' : ''}`} onClick={() => setActivePage('expenses')}>
              <span className="menu-icon"><DollarSign size={18} /></span> Expenses
            </div>

            <div className="sidebar-section-label">Sales & Billing</div>
            <div className={`menu-item ${activePage === 'orders' ? 'active' : ''}`} onClick={() => setActivePage('orders')}>
              <span className="menu-icon"><Receipt size={18} /></span> Orders
            </div>
            <div className={`menu-item ${activePage === 'quotations' ? 'active' : ''}`} onClick={() => setActivePage('quotations')}>
              <span className="menu-icon"><FileText size={18} /></span> Quotes
            </div>
            <div className={`menu-item ${activePage === 'bills' ? 'active' : ''}`} onClick={() => setActivePage('bills')}>
              <span className="menu-icon"><Receipt size={18} /></span> Bills
            </div>
            <div className={`menu-item ${activePage === 'checkout_invoice' ? 'active' : ''}`} onClick={() => setActivePage('checkout_invoice')}>
              <span className="menu-icon"><FileText size={18} /></span> Checkout Invoice
            </div>
            <div className={`menu-item ${activePage === 'payments' ? 'active' : ''}`} onClick={() => setActivePage('payments')}>
              <span className="menu-icon"><CreditCard size={18} /></span> Payments
            </div>

            <div className="sidebar-section-label">Analytics & Comm</div>
            <div className={`menu-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => setActivePage('reports')}>
              <span className="menu-icon"><BarChart3 size={18} /></span> Reports
            </div>
            <div className={`menu-item ${activePage === 'audit_logs' ? 'active' : ''}`} onClick={() => setActivePage('audit_logs')}>
              <span className="menu-icon"><ShieldAlert size={18} /></span> Audit Logs
            </div>
            <div className={`menu-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => setActivePage('settings')}>
              <span className="menu-icon"><Settings size={18} /></span> Settings
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{user.name}</strong>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Administrator</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </aside>
      );
    }
  };

  // Render Page Content Component
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard role={user.role} onNavigate={(page) => setActivePage(page)} />;
      case 'customers':
        return <Customers />;
      case 'vendors':
        return <Vendors />;
      case 'products':
        return <Products />;
      case 'orders':
        return <Orders onNavigate={(page) => setActivePage(page)} />;
      case 'quotations':
        return <Quotations />;
      case 'bills':
        return <Bills />;
      case 'payments':
        return <Payments />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <SettingsPage />;
      
      // Advanced Modules Case mappings
      case 'financial_dashboard':
        return <FinancialDashboard />;
      case 'purchases':
        return <Purchases onNavigate={(page) => setActivePage(page)} />;
      case 'expenses':
        return <Expenses />;
      case 'audit_logs':
        return <AuditLogs />;
      case 'customer_ledgers':
        return <CustomerLedgers onNavigate={(page) => setActivePage(page)} />;
      case 'checkout_invoice':
        return <InvoiceGenerator onNavigate={(page) => setActivePage(page)} />;

      default:
        return <Dashboard role={user.role} onNavigate={(page) => setActivePage(page)} />;
    }
  };

  return (
    <div className="app-container">
      {renderSidebar()}
      <div className="content-area">
        <header className="top-navbar no-print">
          <div className="page-title">
            <span style={{ color: '#94a3b8', fontWeight: '500' }}>Shop &raquo; </span>
            <span style={{ textTransform: 'capitalize', color: '#1e293b' }}>{activePage.replace(/_/g, ' ')}</span>
          </div>

          <div className="nav-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#E8F5F6', padding: '4px 12px', borderRadius: '9999px', border: '1px solid #D9E1E7' }}>
              <Activity size={14} color="#087E8B" />
              <span style={{ color: '#17324D', fontWeight: '600' }}>System Online</span>
            </div>

            <div className="nav-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                {user.role}
              </span>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{user.name}</strong>
            </div>
          </div>
        </header>

        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
