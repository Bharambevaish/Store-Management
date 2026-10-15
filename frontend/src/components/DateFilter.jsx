import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export default function DateFilter({
  value = 'all',
  startDate = '',
  endDate = '',
  onChange,
  className = '',
  style = {}
}) {
  const [filterType, setFilterType] = useState(value);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  useEffect(() => {
    setFilterType(value || 'all');
  }, [value]);

  useEffect(() => {
    setCustomStart(startDate || '');
    setCustomEnd(endDate || '');
  }, [startDate, endDate]);

  const getDateRange = (type, customS = customStart, customE = customEnd) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sDate = '';
    let eDate = '';

    switch (type) {
      case 'today': {
        const dStr = today.toISOString().split('T')[0];
        sDate = dStr;
        eDate = dStr;
        break;
      }
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const dStr = y.toISOString().split('T')[0];
        sDate = dStr;
        eDate = dStr;
        break;
      }
      case 'last_7_days': {
        const s = new Date(today);
        s.setDate(s.getDate() - 6);
        sDate = s.toISOString().split('T')[0];
        eDate = today.toISOString().split('T')[0];
        break;
      }
      case 'last_30_days': {
        const s = new Date(today);
        s.setDate(s.getDate() - 29);
        sDate = s.toISOString().split('T')[0];
        eDate = today.toISOString().split('T')[0];
        break;
      }
      case 'this_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        sDate = firstDay.toISOString().split('T')[0];
        eDate = lastDay.toISOString().split('T')[0];
        break;
      }
      case 'last_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        sDate = firstDay.toISOString().split('T')[0];
        eDate = lastDay.toISOString().split('T')[0];
        break;
      }
      case 'custom': {
        sDate = customS;
        eDate = customE;
        break;
      }
      case 'all':
      default:
        sDate = '';
        eDate = '';
        break;
    }

    return { startDate: sDate, endDate: eDate };
  };

  const handleSelectChange = (e) => {
    const newType = e.target.value;
    setFilterType(newType);
    const { startDate: s, endDate: eDate } = getDateRange(newType);
    if (onChange) {
      onChange({ filterType: newType, startDate: s, endDate: eDate });
    }
  };

  const handleCustomStartChange = (e) => {
    const val = e.target.value;
    setCustomStart(val);
    if (onChange) {
      onChange({ filterType: 'custom', startDate: val, endDate: customEnd });
    }
  };

  const handleCustomEndChange = (e) => {
    const val = e.target.value;
    setCustomEnd(val);
    if (onChange) {
      onChange({ filterType: 'custom', startDate: customStart, endDate: val });
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', ...style }} className={className}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Calendar size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary, #64748B)', pointerEvents: 'none' }} />
        <select
          value={filterType}
          onChange={handleSelectChange}
          style={{
            padding: '8px 12px 8px 32px',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border-light, #D9E1E7)',
            fontSize: '13px',
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            color: 'var(--text-primary, #1F2937)',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          <option value="all">Date Filter: All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last_7_days">Last 7 Days</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {filterType === 'custom' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 500 }}>From:</label>
          <input
            type="date"
            value={customStart}
            onChange={handleCustomStartChange}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border-light, #D9E1E7)',
              fontSize: '13px',
              color: 'var(--text-primary, #1F2937)',
              backgroundColor: 'var(--bg-card, #FFFFFF)'
            }}
          />
          <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', fontWeight: 500 }}>To:</label>
          <input
            type="date"
            value={customEnd}
            onChange={handleCustomEndChange}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border-light, #D9E1E7)',
              fontSize: '13px',
              color: 'var(--text-primary, #1F2937)',
              backgroundColor: 'var(--bg-card, #FFFFFF)'
            }}
          />
        </div>
      )}
    </div>
  );
}
