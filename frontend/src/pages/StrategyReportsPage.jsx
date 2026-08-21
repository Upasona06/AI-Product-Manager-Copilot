import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const StrategyReportsPage = () => {
  const { user } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('executive_summary');

  // Active viewing report
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = async () => {
    if (!user || !user.project_id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/reports?project_id=${user.project_id}`);
      if (response.data.success) {
        setReports(response.data.data);
        // Pre-select the latest report if available and none selected yet
        if (response.data.data.length > 0 && !selectedReport) {
          setSelectedReport(response.data.data[0]);
        }
      } else {
        setError(response.data.error || "Failed to load reports.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch reports from the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user]);

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a report title.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setGenerating(true);

    try {
      const response = await api.post('/api/reports/generate', {
        project_id: user.project_id,
        title: title.trim(),
        report_type: reportType
      });

      if (response.data.success) {
        const newReport = response.data.data;
        setReports(prev => [newReport, ...prev]);
        setSelectedReport(newReport);
        setTitle('');
        setSuccessMsg("Successfully generated new report!");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(response.data.error || "Failed to generate report.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred during report generation. Verify server status.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation(); // Avoid selecting the deleted item
    if (!window.confirm("Are you sure you want to delete this report? This action is permanent.")) {
      return;
    }
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await api.delete(`/api/reports/${reportId}`);
      if (response.data.success) {
        setReports(prev => prev.filter(r => r.report_id !== reportId));
        if (selectedReport && selectedReport.report_id === reportId) {
          setSelectedReport(null);
        }
        setSuccessMsg("Report deleted successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(response.data.error || "Failed to delete report.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to communicate with server to delete report.");
    }
  };

  const handleExportMarkdown = () => {
    if (!selectedReport) return;
    const blob = new Blob([selectedReport.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `${selectedReport.title.toLowerCase().replace(/\s+/g, '_')}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  // Standard lightweight markdown formatter to render markdown nicely in HTML
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    let insideTable = false;
    let tableHeaders = [];
    let tableRows = [];

    const elements = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle table logic
      if (line.trim().startsWith('|')) {
        insideTable = true;
        const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        // Skip separator line | :--- | :--- |
        if (line.includes('---')) {
          continue;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cols;
        } else {
          tableRows.push(cols);
        }
        continue;
      } else if (insideTable) {
        // Table finished, push it to elements
        elements.push(
          <div key={`table-${i}`} className="table-responsive" style={{ margin: '1.5rem 0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {tableHeaders.map((h, idx) => <th key={idx}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((val, cIdx) => <td key={cIdx}>{val}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        insideTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={i} style={{ fontSize: '1.8rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {line.replace('# ', '')}
          </h2>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={i} style={{ fontSize: '1.35rem', color: '#c084fc', marginTop: '1.8rem', marginBottom: '0.8rem' }}>
            {line.replace('## ', '')}
          </h3>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h4 key={i} style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.6rem' }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      // Bullet points
      else if (line.startsWith('* ') || line.startsWith('- ')) {
        const content = line.substring(2);
        // Quick bold parser **text** -> <strong>text</strong>
        const parts = content.split('**');
        elements.push(
          <ul key={i} style={{ paddingLeft: '1.5rem', margin: '0.4rem 0', listStyleType: 'disc' }}>
            <li style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {parts.map((p, idx) => idx % 2 === 1 ? <strong key={idx} style={{ color: '#c084fc' }}>{p}</strong> : p)}
            </li>
          </ul>
        );
      }
      // Paragraph
      else if (line.trim().length > 0) {
        // Quick bold parser **text** -> <strong>text</strong>
        const parts = line.split('**');
        elements.push(
          <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: '1.6', margin: '0.8rem 0' }}>
            {parts.map((p, idx) => idx % 2 === 1 ? <strong key={idx} style={{ color: '#c084fc' }}>{p}</strong> : p)}
          </p>
        );
      }
    }

    return elements;
  };

  return (
    <div className="page-layout">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-meta">
          <h1 className="logo-text" style={{ fontSize: '2.4rem', WebkitTextFillColor: 'unset', color: 'var(--text-primary)', background: 'none' }}>
            Strategy & Summaries
          </h1>
          <div className="project-token">
            Generate executive briefings and product execution strategies.
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert-message error-alert" style={{ marginBottom: '2rem' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-message success-alert" style={{ marginBottom: '2rem' }}>
          <span>✅ {successMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Generate Form & History Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Generation panel */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.25rem' }}>🆕 Create New Report</h3>
            
            <form onSubmit={handleGenerateReport} className="standard-form" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="reportTitle">Report Title</label>
                <input
                  id="reportTitle"
                  type="text"
                  placeholder="e.g. Q4 Release Strategy"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={generating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reportType">Report Template</label>
                <select
                  id="reportType"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  disabled={generating}
                >
                  <option value="executive_summary">📰 Executive Summary</option>
                  <option value="product_strategy">📈 Product Strategy Report</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="action-btn"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {generating ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', display: 'inline-block', margin: '0 0.5rem 0 0' }}></span>
                    Analyzing Context...
                  </>
                ) : (
                  '⚡ Generate Report'
                )}
              </button>
            </form>
          </div>

          {/* Report History Sidebar */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.25rem' }}>📜 Report History</h3>
            
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '0.75rem' }}>
                <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Retrieving archive...</span>
              </div>
            ) : reports.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No saved reports.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {reports.map(r => {
                  const isActive = selectedReport && selectedReport.report_id === r.report_id;
                  const dateStr = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={r.report_id}
                      onClick={() => setSelectedReport(r)}
                      style={{
                        padding: '0.85rem 1rem',
                        background: isActive ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255, 255, 255, 0.015)',
                        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteReport(r.report_id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '0'
                          }}
                          title="Delete report"
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span style={{ textTransform: 'capitalize' }}>
                          {r.report_type.replace('_', ' ')}
                        </span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Display Area */}
        <div className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          {selectedReport ? (
            <>
              {/* Document actions header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <span className="badge category-general" style={{ textTransform: 'capitalize', background: 'rgba(192, 132, 252, 0.1)', color: '#c084fc', marginBottom: '0.5rem' }}>
                    {selectedReport.report_type.replace('_', ' ')}
                  </span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0' }}>{selectedReport.title}</h2>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={handleExportMarkdown}
                    className="action-btn"
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', fontSize: '0.88rem' }}
                  >
                    📥 Export Markdown
                  </button>
                  <button
                    onClick={handlePrint}
                    className="action-btn"
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', fontSize: '0.88rem' }}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Main Document Content */}
              <div className="report-content-body" style={{ flex: '1', overflowY: 'auto' }}>
                {renderMarkdown(selectedReport.content)}
              </div>
            </>
          ) : (
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📈</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Report Selected</h3>
              <p style={{ maxWidth: '400px', margin: '0', fontSize: '0.9rem' }}>
                Choose a strategy report from the history logs or fill out the creation form to compile a new executive summary.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StrategyReportsPage;
