import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Toast from '../components/Toast.jsx';
import {
  validateName,
  sanitizeNameInput,
  sanitizeNumericInput,
  validateRequired,
  validateMobile,
  validateEmail,
  validatePassword,
  trimObjectValues
} from '../utils/formValidation.js';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  // Bulk and Filter States
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Performance Filters
  const [perfStart, setPerfStart] = useState('');
  const [perfEnd, setPerfEnd] = useState('');

  // Form State & Validation
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', mobile: '', role: 'Delivery Staff', joiningDate: '', branchId: '', email: '', password: '' });
  const [formErrors, setFormErrors] = useState({});

  const fetchData = async () => {
    try {
      const [empRes, branchRes] = await Promise.all([
        api.get('/employees'),
        api.get('/branches')
      ]);
      setEmployees(empRes.data);
      setBranches(branchRes.data);
      if (branchRes.data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: branchRes.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load employee list or branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    setPerfLoading(true);
    try {
      let params = [];
      if (perfStart) params.push(`startDate=${perfStart}`);
      if (perfEnd) params.push(`endDate=${perfEnd}`);
      const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
      
      const res = await api.get(`/employees/performance${queryStr}`);
      setPerformance(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch employee delivery performance metrics');
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPerformance();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    const errs = {};

    const nameErr = validateName(formData.name, 'Employee Name');
    if (nameErr) errs.name = nameErr;

    const mobErr = validateMobile(formData.mobile);
    if (mobErr) errs.mobile = mobErr;

    if (formData.email) {
      const emailErr = validateEmail(formData.email);
      if (emailErr) errs.email = emailErr;
    }

    if (formData.password) {
      const passErr = validatePassword(formData.password);
      if (passErr) errs.password = passErr;
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSuccess('');
    setError('');
    try {
      const cleanData = trimObjectValues(formData);
      await api.post('/employees', cleanData);
      setToast({ type: 'success', message: 'Employee profile registered successfully! ✅' });
      setShowAdd(false);
      setFormData({ name: '', mobile: '', role: 'Delivery Staff', joiningDate: '', branchId: branches[0]?._id || '', email: '', password: '' });
      fetchData();
      fetchPerformance();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to register employee';
      setError(msg);
      setToast({ type: 'error', message: msg });
    }
  };

  const handleToggleStatus = async (employee) => {
    setSuccess('');
    setError('');
    const nextStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/employees/${employee._id}`, { status: nextStatus });
      setSuccess(`Employee status updated to ${nextStatus}! ✅`);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee? This will also remove their user account.')) return;
    setSuccess('');
    setError('');
    try {
      await api.delete(`/employees/${id}`);
      setSuccess('Employee profile deleted successfully. ✅');
      fetchData();
      fetchPerformance();
    } catch (err) {
      console.error(err);
      setError('Failed to delete employee profile');
    }
  };

  const filteredEmployeesList = employees.filter(emp => {
    if (selectedRole && emp.role !== selectedRole) return false;
    if (selectedBranch) {
      const bId = emp.branchId?._id || emp.branchId;
      if (bId !== selectedBranch) return false;
    }
    return true;
  });

  const handleSelectAll = (evt) => {
    if (evt.target.checked) {
      setSelectedIds(filteredEmployeesList.map(emp => emp._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected employee profiles? This will also remove their user accounts.`)) return;
    try {
      setError('');
      setSuccess('');
      await api.post('/bulk/delete', { model: 'employee', ids: selectedIds });
      setSuccess(`Deleted ${selectedIds.length} employees. ✅`);
      setSelectedIds([]);
      fetchData();
      fetchPerformance();
    } catch (err) {
      console.error(err);
      setError('Failed to perform bulk delete');
    }
  };

  const handleBulkRoleUpdate = async (role) => {
    if (!role) return;
    try {
      setError('');
      setSuccess('');
      await api.post('/bulk/status', { model: 'employee', ids: selectedIds, updates: { role } });
      setSuccess(`Updated role for ${selectedIds.length} employees. ✅`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update roles in bulk');
    }
  };

  const handleBulkExport = () => {
    const dataToExport = employees.filter(emp => selectedIds.includes(emp._id));
    const cleanData = dataToExport.map(emp => ({
      Name: emp.name,
      Mobile: emp.mobile,
      Role: emp.role,
      Status: emp.status,
      JoiningDate: new Date(emp.joiningDate).toLocaleDateString(),
      Branch: emp.branchId?.name || emp.branchId,
      Email: emp.user?.email || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "selected_employees.xlsx");
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading employees catalog...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {success && (
        <div style={{ padding: '12px', background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Role</label>
          <select 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Roles</option>
            <option value="Delivery Staff">Delivery Staff</option>
            <option value="Sales Executive">Sales Executive</option>
            <option value="Warehouse Staff">Warehouse Staff</option>
            <option value="Branch Manager">Branch Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        {branches.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Branch</label>
            <select 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: '15px', background: 'var(--primary-light, #E8F5F6)', padding: '15px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-light, #D9E1E7)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--primary, #087E8B)', fontWeight: '600' }}>
            Selected <strong>{selectedIds.length}</strong> staff profiles
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary, #087E8B)' }}>Update Role:</label>
            <select 
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkRoleUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px' }}
            >
              <option value="">Select Role...</option>
              <option value="Delivery Staff">Delivery Staff</option>
              <option value="Sales Executive">Sales Executive</option>
              <option value="Warehouse Staff">Warehouse Staff</option>
              <option value="Branch Manager">Branch Manager</option>
              <option value="Admin">Admin</option>
            </select>

            <button 
              onClick={handleBulkExport}
              style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              📥 Export to Excel
            </button>
            <button 
              onClick={handleBulkDelete}
              style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              🗑️ Bulk Delete
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              style={{ padding: '8px 16px', background: '#cbd5e1', color: '#1e293b', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Employees CRUD List */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>👥 Staff List</h3>
          <button 
            onClick={() => setShowAdd(true)}
            style={{ padding: '8px 16px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
          >
            Add Staff
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 15px', width: '40px' }}>
                <input 
                  type="checkbox"
                  checked={filteredEmployeesList.length > 0 && selectedIds.length === filteredEmployeesList.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Sr. No.</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Name</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Mobile</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Role</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Joining Date</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployeesList.length > 0 ? (
              filteredEmployeesList.map((emp, idx) => (
                <tr key={emp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 15px', width: '40px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(emp._id)}
                      onChange={() => handleSelectRow(emp._id)}
                    />
                  </td>
                  <td style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 15px', fontWeight: '600', color: '#334155' }}>{emp.name}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.mobile}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.branch?.name || 'N/A'}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.role}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{new Date(emp.joiningDate).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 15px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: emp.status === 'Active' ? '#d1fae5' : '#fee2e2',
                      color: emp.status === 'Active' ? '#065f46' : '#b91c1c',
                      fontWeight: 'bold'
                    }}>
                      {emp.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 15px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleToggleStatus(emp)}
                      style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Toggle Status
                    </button>
                    <button 
                      onClick={() => handleDelete(emp._id)}
                      style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No employees found matching the filter criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Employee Delivery Performance Report */}
      <div style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-light, #D9E1E7)', borderRadius: 'var(--radius-lg, 10px)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary, #1F2937)' }}>🚚 Staff Performance</h3>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="date" value={perfStart} onChange={(e) => setPerfStart(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
            <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
            <input type="date" value={perfEnd} onChange={(e) => setPerfEnd(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
            <button 
              onClick={fetchPerformance}
              style={{ padding: '6px 14px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
            >
              Filter
            </button>
          </div>
        </div>

        {perfLoading ? (
          <div>Loading performance...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Driver Name</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Deliveries Completed</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Avg Delivery Time</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>On-Time</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Delayed</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#334155' }}>{p.name}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{p.branchName}</td>
                  <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#166534' }}>{p.deliveriesCompleted} Runs</td>
                  <td style={{ padding: '10px 15px', color: 'var(--primary, #087E8B)', fontWeight: 'bold' }}>{p.averageDeliveryTimeInMinutes} Mins</td>
                  <td style={{ padding: '10px 15px', color: '#166534', fontWeight: '600' }}>{p.onTimeDeliveries}</td>
                  <td style={{ padding: '10px 15px', color: '#b91c1c', fontWeight: '600' }}>{p.delayedDeliveries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Register Employee Profile</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Employee Name*</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: sanitizeNameInput(e.target.value) });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.name ? '#ef4444' : '#cbd5e1'}` }}
                />
                {formErrors.name && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.name}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Mobile Number*</label>
                <input 
                  type="tel"
                  maxLength={10}
                  value={formData.mobile}
                  onChange={(e) => {
                    setFormData({ ...formData, mobile: sanitizeNumericInput(e.target.value, 10) });
                    if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: '' });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${formErrors.mobile ? '#ef4444' : '#cbd5e1'}` }}
                />
                {formErrors.mobile && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.mobile}</span>}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Role Profile*</label>
                  <select 
                    value={formData.role} 
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Delivery Staff">Delivery Staff</option>
                    <option value="Packer">Packer</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Branch Scoped*</label>
                  <select 
                    value={formData.branchId} 
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    {branches.map(br => (
                      <option key={br._id} value={br._id}>{br.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Date of Joining</label>
                <input 
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <strong style={{ fontSize: '12px', color: '#334155', display: 'block', marginBottom: '8px' }}>Create Portal Login (Optional)</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Login Email</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                      }}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${formErrors.email ? '#ef4444' : '#cbd5e1'}`, background: '#fff' }}
                    />
                    {formErrors.email && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.email}</span>}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Password</label>
                    <input 
                      type="password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                      }}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${formErrors.password ? '#ef4444' : '#cbd5e1'}`, background: '#fff' }}
                    />
                    {formErrors.password && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block' }}>{formErrors.password}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: 'var(--primary, #087E8B)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'success', message: '' })}
      />

    </div>
  );
}
