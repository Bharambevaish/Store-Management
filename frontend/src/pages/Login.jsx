import React, { useState } from 'react';
import api, { setAccessToken } from '../services/api';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCanRetry(false);
    
    if (!email || !password) {
      setError('Please fill in email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      setAccessToken(token);
      onLoginSuccess(user);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError('The email or password is incorrect.');
      } else if (!err.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
        setError('The server may be waking up. Wait a moment, then retry the connection.');
        setCanRetry(true);
      } else {
        setError(err.response?.data?.error || 'Unable to sign in right now. Please retry.');
        setCanRetry(true);
      }
      setLoading(false);
    }
  };

  return (
    <div className="modern-login-container">
      <div className="modern-login-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="login-header-modern">
          <div className="logo-wrapper" style={{ background: '#087E8B', color: '#fff' }}>
            {/* Shop SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: '28px', height: '28px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div className="login-brand-lockup">
            <p className="login-brand-name">NARESH ENTERPRISES</p>
            <p className="login-brand-desc">Distribution Management ERP</p>
          </div>
          <h1 style={{ color: '#17324D', marginTop: '12px', fontSize: '20px' }}>Shop Manager</h1>
          <p style={{ color: '#64748B' }}>Sign in to manage stock and orders</p>
        </div>

        {error && (
          <div className="modern-toast" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', display: 'flex', gap: '8px', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modern-form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Owner Email Address</label>
            <div className="modern-input-wrapper" style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                required
              />
            </div>
          </div>

          <div className="modern-form-group" style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Password</label>
            <div className="modern-input-wrapper">
              <input 
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="login-btn-modern" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#087E8B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {loading ? 'Connecting securely...' : canRetry ? 'Retry connection' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
