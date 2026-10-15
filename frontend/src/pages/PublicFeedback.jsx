import React, { useState } from 'react';
import api from '../services/api';

export default function PublicFeedback() {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const orderId = window.location.pathname.split('/').pop();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/orders/${orderId}/feedback`, { rating, comment });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Failed to submit feedback. Invalid order or already submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main, #F6F8FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '40px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>💖</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--status-success, #198754)', marginBottom: '10px' }}>Thank You!</h2>
          <p style={{ color: 'var(--text-secondary, #64748B)' }}>Your feedback has been submitted successfully. We appreciate your time.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main, #F6F8FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'var(--bg-card, #FFFFFF)', padding: '30px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>How was your delivery?</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', marginTop: '5px' }}>Order Ref: {orderId.substring(18).toUpperCase()}</p>
        </div>

        {error && <div style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '15px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary, #64748B)', marginBottom: '10px', textAlign: 'center' }}>Rate your experience</label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '32px', 
                    cursor: 'pointer', 
                    color: star <= rating ? '#f59e0b' : '#cbd5e1',
                    transition: 'color 0.2s'
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary, #64748B)', marginBottom: '5px' }}>Additional Comments</label>
            <textarea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what you loved or what we can improve..."
              rows="4"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }}
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            style={{ 
              padding: '12px', 
              background: 'var(--primary, #087E8B)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 'var(--radius-md, 8px)', 
              fontWeight: 'bold', 
              fontSize: '15px', 
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
