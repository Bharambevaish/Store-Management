import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StudentReport() {
  const [activeReport, setActiveReport] = useState('list'); // 'list' or 'count'
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // -- List Report State --
  const [listReportType, setListReportType] = useState('academic'); // 'academic' or 'admission'
  const [listFilters, setListFilters] = useState({
    academicYear: '2026-27',
    courseName: '',
    className: '',
    attribute: '',
    value: ''
  });
  const [students, setStudents] = useState([]);
  
  // -- Count Report State --
  const [countReportType, setCountReportType] = useState('course'); // 'course', 'class', 'category', 'admissionType'
  const [countFilters, setCountFilters] = useState({
    academicYear: '2026-27',
    onlyActive: true
  });
  const [countData, setCountData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const coursesRes = await api.get('/courses');
      setCourses(coursesRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ----- LIST REPORT LOGIC -----
  const handleListFilterChange = (e) => {
    const { name, value } = e.target;
    setListFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchListReport = async (showInactive = false) => {
    setLoading(true);
    try {
      // Build query string
      let query = `?limit=1000`;
      if (listFilters.courseName) query += `&course=${listFilters.courseName}`;
      
      if (listReportType === 'academic') {
        if (listFilters.academicYear) query += `&academicYear=${listFilters.academicYear}`;
      } else {
        if (listFilters.academicYear) query += `&admissionYear=${listFilters.academicYear}`;
      }

      if (!showInactive) query += `&status=Active`;
      else query += `&status=Inactive`;
      
      const res = await api.get(`/students${query}`);
      let data = res.data.students || [];

      // Manual filtering for extra attributes
      if (listFilters.className) {
        const cls = listFilters.className.toLowerCase();
        let semHints = [cls];
        if (cls === 'fy') semHints = ['1', '2'];
        if (cls === 'sy') semHints = ['3', '4'];
        if (cls === 'ty') semHints = ['5', '6'];
        if (cls === 'ly' || cls === 'btech') semHints = ['7', '8'];
        
        data = data.filter(s => {
          const sSem = String(s.semester || '').toLowerCase();
          return semHints.some(hint => sSem.includes(hint)) || sSem.includes(cls);
        });
      }

      if (listFilters.attribute && listFilters.value) {
        const attr = listFilters.attribute;
        const val = listFilters.value.toLowerCase();
        data = data.filter(s => {
          if (!s[attr]) return false;
          return String(s[attr]).toLowerCase().includes(val);
        });
      }

      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ----- COUNT REPORT LOGIC -----
  const handleCountFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCountFilters(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const fetchCountReport = async () => {
    setLoading(true);
    try {
      const query = countFilters.onlyActive ? '?status=Active&limit=2000' : '?limit=2000';
      const res = await api.get(`/students${query}`);
      const data = res.data.students || [];

      let grouped = {};
      let total = 0;

      data.forEach(s => {
        let key = 'Unknown';
        if (countReportType === 'course') key = s.course || 'Unassigned';
        if (countReportType === 'class') key = s.department || 'Unassigned';
        if (countReportType === 'category') key = s.category || 'General';
        if (countReportType === 'admissionType') key = s.admissionType || 'Regular';
        
        grouped[key] = (grouped[key] || 0) + 1;
        total++;
      });

      const aggregated = Object.keys(grouped).map(k => ({ label: k, count: grouped[k] }));
      setCountData(aggregated);
      setTotalCount(total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-wrapper">
      <div className="btn-container no-print" style={{ marginBottom: '15px' }}>
        <button className={activeReport === 'list' ? 'primary' : 'secondary'} onClick={() => setActiveReport('list')}>
          Students Report (List)
        </button>
        <button className={activeReport === 'count' ? 'primary' : 'secondary'} onClick={() => setActiveReport('count')}>
          Student Count Report
        </button>
      </div>

      <div className="card">
        {activeReport === 'list' ? (
          <>
            <div className="card-header">
              <h3 style={{ margin: 0, color: '#2F5597' }}>Students Report</h3>
            </div>
            <div className="card-body">
              {/* Report Types */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" checked={listReportType === 'academic'} onChange={() => setListReportType('academic')} />
                  Academic Yearwise Report
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" checked={listReportType === 'admission'} onChange={() => setListReportType('admission')} />
                  Admission Yearwise Report
                </label>
              </div>

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '20px', alignItems: 'end' }}>
                <div className="form-group">
                  <label>Academic Year</label>
                  <select name="academicYear" value={listFilters.academicYear} onChange={handleListFilterChange}>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                    <option value="2027-28">2027-28</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Course Name</label>
                  <select name="courseName" value={listFilters.courseName} onChange={handleListFilterChange}>
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c._id} value={c.department}>{c.name} ({c.courseId})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Class</label>
                  <input type="text" name="className" value={listFilters.className} onChange={handleListFilterChange} placeholder="e.g. FY, SY" />
                </div>
                <div className="form-group">
                  <label>Attribute</label>
                  <select name="attribute" value={listFilters.attribute} onChange={handleListFilterChange}>
                    <option value="">Select</option>
                    <option value="gender">Gender</option>
                    <option value="bloodGroup">Blood Group</option>
                    <option value="category">Category</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Value</label>
                  <input type="text" name="value" value={listFilters.value} onChange={handleListFilterChange} placeholder="Search value..." />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button className="primary" onClick={() => fetchListReport(false)}>Show</button>
                <button className="danger" onClick={() => fetchListReport(true)}>Show Inactive</button>
              </div>

              {/* Table */}
              <div className="table-container">
                {loading ? <p style={{ padding: '20px' }}>Loading students...</p> : (
                  <table>
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Course</th>
                        <th>Gender</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No students match the criteria.</td></tr>
                      ) : students.map(s => (
                        <tr key={s._id}>
                          <td>{s.studentId}</td>
                          <td>{s.firstName} {s.lastName}</td>
                          <td>{s.course}</td>
                          <td>{s.gender || '-'}</td>
                          <td>
                            <span className={`badge ${s.status === 'Active' ? 'active' : 'inactive'}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card-header">
              <h3 style={{ margin: 0, color: '#2F5597' }}>Student Count Report</h3>
            </div>
            <div className="card-body">
              {/* Report Tabs */}
              <div className="tabs-container" style={{ display: 'flex', gap: '15px', padding: '10px 0', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
                {['course', 'class', 'category', 'admissionType'].map(type => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => setCountReportType(type)}
                    style={{
                      background: 'none', border: 'none', padding: '5px 10px', cursor: 'pointer',
                      borderBottom: countReportType === type ? '2px solid #2F5597' : '2px solid transparent',
                      fontWeight: countReportType === type ? 'bold' : 'normal',
                      color: countReportType === type ? '#2F5597' : '#555',
                      textTransform: 'capitalize'
                    }}
                  >
                    {type === 'admissionType' ? 'Admission Type Wise' : `${type} Wise`}
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Academic Year</label>
                  <select name="academicYear" value={countFilters.academicYear} onChange={handleCountFilterChange} style={{ minWidth: '150px' }}>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                    <option value="2027-28">2027-28</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '20px', cursor: 'pointer' }}>
                    <input type="checkbox" name="onlyActive" checked={countFilters.onlyActive} onChange={handleCountFilterChange} />
                    Only Active Students
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button className="primary" onClick={fetchCountReport}>Show Count</button>
                <button className="secondary" onClick={handlePrint}>Print</button>
              </div>

              {/* Output Table */}
              <div className="table-container printable-area">
                {loading ? <p style={{ padding: '20px' }}>Generating report...</p> : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textTransform: 'capitalize' }}>{countReportType.replace(/([A-Z])/g, ' $1').trim()}</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Student Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {countData.length === 0 ? (
                        <tr><td colSpan="2" style={{ textAlign: 'center' }}>No data to display. Click "Show" to generate.</td></tr>
                      ) : (
                        <>
                          {countData.map((row, i) => (
                            <tr key={i}>
                              <td>{row.label}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.count}</td>
                            </tr>
                          ))}
                          <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                            <td style={{ textAlign: 'right' }}>Grand Total:</td>
                            <td style={{ textAlign: 'center', color: '#C00000' }}>{totalCount}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
