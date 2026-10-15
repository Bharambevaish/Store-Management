import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export default function Toast({ type = 'success', message, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isInfo = type === 'info';

  const bgColor = isSuccess ? 'var(--success-light, #D1E7DD)' : isError ? 'var(--danger-light, #F8D7DA)' : 'var(--primary-light, #E8F5F6)';
  const borderColor = isSuccess ? 'var(--success, #198754)' : isError ? 'var(--danger, #DC3545)' : 'var(--primary, #087E8B)';
  const textColor = isSuccess ? 'var(--success, #198754)' : isError ? 'var(--danger, #DC3545)' : 'var(--primary, #087E8B)';
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertCircle : Info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md, 8px)',
        color: textColor,
        boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06))',
        fontSize: '14px',
        fontWeight: '500',
        maxWidth: '420px',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <Icon size={20} style={{ flexShrink: 0 }} />
      <span style={{ flexGrow: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: textColor,
          padding: '2px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
