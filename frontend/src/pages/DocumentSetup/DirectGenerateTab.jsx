import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function DirectGenerateTab({ triggerAlert }) {
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  
  const [previewHtml, setPreviewHtml] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stuRes, tempRes] = await Promise.all([
        api.get('/students?limit=100'),
        api.get('/documents/templates')
      ]);
      setStudents(stuRes.data.students || []);
      setTemplates(tempRes.data || []);
    } catch (err) {
      triggerAlert('error', 'Failed to load students or templates');
    }
  };

  const handlePreview = () => {
    if (!selectedStudent || !selectedTemplate) {
      triggerAlert('error', 'Please select a student and a document template first.');
      return;
    }

    const student = students.find(s => s._id === selectedStudent);
    const template = templates.find(t => t._id === selectedTemplate);

    if (student && template) {
      let content = template.richTextContent;
      // Replace dynamic variables
      content = content.replace(/{{StudentName}}/g, `${student.firstName} ${student.lastName}`);
      content = content.replace(/{{RollNo}}/g, student.rollNumber || 'N/A');
      content = content.replace(/{{Course}}/g, student.course || 'N/A');
      content = content.replace(/{{Semester}}/g, student.semester || 'N/A');
      content = content.replace(/{{AdmissionNo}}/g, student.studentId || 'N/A');
      content = content.replace(/{{IssueDate}}/g, new Date().toLocaleDateString());
      content = content.replace(/{{InstituteName}}/g, 'Demo Institute');

      setPreviewHtml(content);
    }
  };

  const handleGenerate = async () => {
    if (!previewHtml) {
      triggerAlert('error', 'Please preview the document first.');
      return;
    }
    setGenerating(true);
    const student = students.find(s => s._id === selectedStudent);
    const template = templates.find(t => t._id === selectedTemplate);

    try {
      // Create Document Register entry
      const payload = {
        documentNumber: `DOC-${Date.now().toString().slice(-6)}`,
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        rollNumber: student.rollNumber,
        documentType: template.templateName,
        generatedBy: 'Admin'
      };

      await api.post('/documents/register', payload);
      triggerAlert('success', 'Document Generated & Saved to Register successfully!');
      
      // Trigger print dialogue for the generated document
      setTimeout(() => {
        window.print();
      }, 500);

    } catch (err) {
      triggerAlert('error', 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }} className="no-print">
        <div className="form-group">
          <label>1. Select Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">-- Search & Select Student --</option>
            {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.rollNumber || s.studentId})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>2. Select Document Template</label>
          <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
            <option value="">-- Select Template --</option>
            {templates.map(t => <option key={t._id} value={t._id}>{t.templateName}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }} className="no-print">
        <button className="secondary" onClick={handlePreview}>3. Preview</button>
        <button className="primary" onClick={handleGenerate} disabled={generating || !previewHtml}>
          4. Generate & Print
        </button>
      </div>

      {previewHtml && (
        <div style={{ border: '1px solid #ccc', padding: '40px', backgroundColor: '#fff', minHeight: '500px', borderRadius: '4px' }}>
          <div className="printable-area" dangerouslySetInnerHTML={{ __html: previewHtml }}></div>
        </div>
      )}
    </div>
  );
}
