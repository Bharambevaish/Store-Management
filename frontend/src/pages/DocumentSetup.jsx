import React, { useState } from 'react';
import AddDocumentTab from './DocumentSetup/AddDocumentTab';
import DocumentSettingsTab from './DocumentSetup/DocumentSettingsTab';
import AddAuthoritiesTab from './DocumentSetup/AddAuthoritiesTab';
import AddApprovalPathTab from './DocumentSetup/AddApprovalPathTab';
import AddTemplateTab from './DocumentSetup/AddTemplateTab';
import DocumentRegisterTab from './DocumentSetup/DocumentRegisterTab';
import DirectGenerateTab from './DocumentSetup/DirectGenerateTab';

export default function DocumentSetup() {
  const [activeTab, setActiveTab] = useState('Add Document');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  const triggerAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 4000);
  };

  const tabs = [
    'Add Document', 'Document Settings', 'Add Authorities', 
    'Add Approval Path', 'Add Template', 'Document Register', 'Direct Generate'
  ];

  return (
    <div className="page-wrapper">
      <div className="card">
        {alert.show && (
          <div className={`alert-banner ${alert.type}`} style={{ margin: '0 0 15px 0' }}>
            <span>{alert.type === 'success' ? '✅' : '⚠️'} {alert.message}</span>
            <span className="close-alert" onClick={() => setAlert({ show: false })}>×</span>
          </div>
        )}

        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '24px' }}>📘</div>
          <h3 style={{ margin: 0, color: '#2F5597' }}>Add Documents</h3>
        </div>

        <div className="card-body">
          <div style={{ backgroundColor: '#aaccff', height: '10px', borderRadius: '4px', marginBottom: '20px' }}></div>

          {/* Radio buttons options */}
          <div className="tabs-container" style={{ display: 'flex', gap: '15px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', marginBottom: '20px', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <label key={tab} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input 
                  type="radio" 
                  name="docTab" 
                  checked={activeTab === tab} 
                  onChange={() => setActiveTab(tab)} 
                /> 
                {tab}
              </label>
            ))}
          </div>

          <div style={{ marginTop: '20px' }}>
            {activeTab === 'Add Document' && <AddDocumentTab triggerAlert={triggerAlert} />}
            {activeTab === 'Document Settings' && <DocumentSettingsTab triggerAlert={triggerAlert} />}
            {activeTab === 'Add Authorities' && <AddAuthoritiesTab triggerAlert={triggerAlert} />}
            {activeTab === 'Add Approval Path' && <AddApprovalPathTab triggerAlert={triggerAlert} />}
            {activeTab === 'Add Template' && <AddTemplateTab triggerAlert={triggerAlert} />}
            {activeTab === 'Document Register' && <DocumentRegisterTab triggerAlert={triggerAlert} />}
            {activeTab === 'Direct Generate' && <DirectGenerateTab triggerAlert={triggerAlert} />}
          </div>
          
        </div>
      </div>
    </div>
  );
}
