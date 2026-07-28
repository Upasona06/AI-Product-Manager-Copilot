import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const PrioritizationPage = () => {
  const { user } = useContext(AuthContext);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningPrioritization, setRunningPrioritization] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter and pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priorityClass, setPriorityClass] = useState('');
  const [moscow, setMoscow] = useState('');
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortOrder, setSortOrder] = useState('desc');

  // Detailed Modal overlay
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Metrics summary
  const [metrics, setMetrics] = useState({
    total: 0,
    highPriority: 0,
    mustHave: 0,
    avgRoi: 0
  });

  const fetchPrioritizationData = async () => {
    if (!user || !user.project_id) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        project_id: user.project_id,
        page: page,
        page_size: pageSize,
        search: search,
        category: category,
        priority_class: priorityClass,
        moscow: moscow,
        sort_by: sortBy,
        sort_order: sortOrder
      });

      const response = await api.get(`/prioritize/results?${queryParams.toString()}`);
      if (response.data.success) {
        setFeatures(response.data.data.results);
        setTotalRecords(response.data.data.total);

        // Fetch overall stats for summary (we can compute this or make an lightweight call)
        // For simplicity, we calculate metrics from first 100 features or general data
        // Let's compute them from current page features and general statistics
        const results = response.data.data.results || [];
        const total = response.data.data.total || 0;
        
        // Calculate average values from current page features to give context
        const avgRoiVal = results.length > 0 
          ? results.reduce((acc, curr) => acc + curr.roi_score, 0) / results.length 
          : 0;

        // Fetch first page with no filters to get overall metric counts (optional, or calculate based on list)
        setMetrics({
          total: total,
          highPriority: results.filter(f => f.priority_class === 'High').length,
          mustHave: results.filter(f => f.moscow_category === 'Must Have').length,
          avgRoi: avgRoiVal
        });
      } else {
        setError(response.data.error || "Failed to load prioritization results.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Failed to retrieve prioritized records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrioritizationData();
  }, [user, page, search, category, priorityClass, moscow, sortBy, sortOrder]);

  const handleRunPrioritization = async () => {
    setRunningPrioritization(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await api.post('/prioritize/run', { 
        project_id: user.project_id,
        force: true 
      });
      if (response.data.success) {
        const stats = response.data.data.stats;
        setSuccessMsg(
          `AI prioritizer executed! Processed: ${stats.processed}, Skipped: ${stats.skipped}, Failed: ${stats.failed}.`
        );
        // Reset page and reload
        setPage(1);
        fetchPrioritizationData();
      } else {
        setError(response.data.error || "Failed to run AI prioritization.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to run AI prioritization service.");
    } finally {
      setRunningPrioritization(false);
    }
  };

  const handleNextPage = () => {
    if (page * pageSize < totalRecords) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  return (
    <div className="prioritization-page page-layout">
      {/* Page Header */}
      <div className="page-header flex-header">
        <div>
          <h1>AI Prioritization & Business Impact Analysis</h1>
          <p>Consolidated product feature backlog evaluated via RICE, MoSCoW, ROI, and Business Value frameworks.</p>
        </div>
        
        <button 
          className="action-btn run-pipeline-btn" 
          onClick={handleRunPrioritization} 
          disabled={runningPrioritization}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {runningPrioritization ? (
            <>
              <span className="spinner-mini"></span>
              Analyzing Backlog...
            </>
          ) : "🤖 Run AI Prioritization"}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="alert-message success-alert" style={{ marginBottom: '1.5rem' }}>
          <strong>Success: </strong> {successMsg}
        </div>
      )}
      {error && (
        <div className="alert-message error-alert" style={{ marginBottom: '1.5rem' }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
        <div className="metric-card glass-panel">
          <span className="metric-icon">🎯</span>
          <div className="metric-data">
            <span className="metric-value">{metrics.total}</span>
            <span className="metric-label">Prioritized Items</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <span className="metric-icon">🚀</span>
          <div className="metric-data">
            <span className="metric-value">{metrics.highPriority}</span>
            <span className="metric-label">High Priority (Page)</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <span className="metric-icon">🔥</span>
          <div className="metric-data">
            <span className="metric-value">{metrics.mustHave}</span>
            <span className="metric-label">Must Haves (Page)</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <span className="metric-icon">💸</span>
          <div className="metric-data">
            <span className="metric-value">{metrics.avgRoi.toFixed(2)}</span>
            <span className="metric-label">Avg ROI Score (Page)</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: '1', minWidth: '300px' }}>
          {/* Search Feature Name */}
          <input 
            type="text" 
            placeholder="Search features..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="filter-input-search"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              minWidth: '200px',
              outline: 'none'
            }}
          />

          {/* Category Filter */}
          <select 
            value={category} 
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: '#16162a',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="">All Categories</option>
            <option value="Bug">Bugs</option>
            <option value="Feature Request">Feature Requests</option>
            <option value="Improvement">Improvements</option>
            <option value="Complaint">Complaints</option>
            <option value="General">General</option>
          </select>

          {/* Priority Class Filter */}
          <select 
            value={priorityClass} 
            onChange={(e) => { setPriorityClass(e.target.value); setPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: '#16162a',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* MoSCoW Filter */}
          <select 
            value={moscow} 
            onChange={(e) => { setMoscow(e.target.value); setPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: '#16162a',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="">All MoSCoW</option>
            <option value="Must Have">Must Have</option>
            <option value="Should Have">Should Have</option>
            <option value="Could Have">Could Have</option>
            <option value="Won't Have">Won't Have</option>
          </select>
        </div>

        {/* Sorting controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort By:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: '#16162a',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="priority_score">Priority Score</option>
            <option value="roi_score">ROI (Value/Effort)</option>
            <option value="impact_score">Impact</option>
            <option value="effort_score">Effort</option>
            <option value="risk_score">Risk</option>
            <option value="rice_score">RICE Score</option>
            <option value="weight">Reach (Weight)</option>
          </select>
          <button 
            onClick={toggleSortOrder} 
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--border-radius-sm)',
              cursor: 'pointer'
            }}
            title={sortOrder === 'desc' ? "Sort Descending" : "Sort Ascending"}
          >
            {sortOrder === 'desc' ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* Main Backlog List Table */}
      {loading && features.length === 0 ? (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>Analyzing prioritizing algorithms...</p>
        </div>
      ) : features.length === 0 ? (
        <div className="empty-state glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <span style={{ fontSize: '3rem' }}>🎯</span>
          <h3>No features prioritized yet</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            There are no prioritized features matching the current filters. Clean processed feedback must exist to compute prioritization models.
          </p>
          <button className="action-btn" onClick={handleRunPrioritization} disabled={runningPrioritization}>
            {runningPrioritization ? "Analyzing..." : "Trigger AI Prioritization"}
          </button>
        </div>
      ) : (
        <div className="status-panel-container glass-panel" style={{ padding: '1.5rem' }}>
          <h3 className="section-title">AI-Prioritized Backlog</h3>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature Details</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Reach</th>
                  <th style={{ textAlign: 'center' }}>Impact</th>
                  <th style={{ textAlign: 'center' }}>Effort</th>
                  <th style={{ textAlign: 'center' }}>Risk</th>
                  <th style={{ textAlign: 'center' }}>ROI</th>
                  <th style={{ textAlign: 'center' }}>MoSCoW</th>
                  <th style={{ textAlign: 'center' }}>Priority Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feat) => {
                  const hasConfidenceGlow = feat.rice_confidence < 70;
                  return (
                    <tr key={feat.prioritization_id}>
                      <td className="table-subject" style={{ maxWidth: '300px' }}>
                        <div 
                          className="subject-text" 
                          style={{ cursor: 'pointer', fontWeight: '600' }}
                          onClick={() => setSelectedFeature(feat)}
                          title={feat.feature_name}
                        >
                          {feat.feature_name}
                        </div>
                        {feat.description && (
                          <div className="group-id-text" style={{ fontSize: '0.8rem', opacity: '0.7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {feat.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge category-${feat.category.toLowerCase().replace(' ', '-')}`}>
                          {feat.category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{feat.rice_reach}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {feat.impact_score.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {feat.effort_score.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {feat.risk_score.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: feat.roi_score >= 2.0 ? 'var(--color-success)' : 'inherit', fontWeight: 'bold' }}>
                          {feat.roi_score.toFixed(1)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`moscow-badge moscow-${feat.moscow_category.toLowerCase().replace(' ', '-')}`}>
                          {feat.moscow_category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge priority-${feat.priority_class.toLowerCase()}`} style={{ fontSize: '0.9rem', fontWeight: 'bold', padding: '0.3rem 0.75rem' }}>
                          {feat.priority_score.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => setSelectedFeature(feat)}
                          style={{
                            background: 'rgba(124, 58, 237, 0.15)',
                            color: '#c084fc',
                            border: '1px solid rgba(124, 58, 237, 0.4)',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'var(--accent-primary)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)';
                            e.currentTarget.style.color = '#c084fc';
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination component */}
      {totalRecords > 0 && (
        <div className="pagination-bar" style={{ marginTop: '1.5rem' }}>
          <button 
            className="pagination-btn" 
            onClick={handlePrevPage} 
            disabled={page === 1}
          >
            ◀ Previous
          </button>
          
          <span className="pagination-info">
            Page {page} of {totalPages} (Total: {totalRecords} features)
          </span>
          
          <button 
            className="pagination-btn" 
            onClick={handleNextPage} 
            disabled={page >= totalPages}
          >
            Next ▶
          </button>
        </div>
      )}

      {/* Premium Detail Overlay Modal */}
      {selectedFeature && (
        <div className="modal-backdrop" onClick={() => setSelectedFeature(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className={`badge category-${selectedFeature.category.toLowerCase().replace(' ', '-')}`} style={{ marginBottom: '0.5rem' }}>
                  {selectedFeature.category}
                </span>
                <h2>{selectedFeature.feature_name}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedFeature(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              {/* Feature Description */}
              <div className="detail-section">
                <h4>Description</h4>
                <p>{selectedFeature.description || "No description provided."}</p>
              </div>

              {/* RICE and Metrics Breakdowns */}
              <div className="metrics-summary-grid-modal">
                <div className="metric-box">
                  <span className="box-title">Reach (Weight)</span>
                  <span className="box-value">{selectedFeature.rice_reach}</span>
                  <span className="box-desc">Consolidated feedback count</span>
                </div>
                <div className="metric-box">
                  <span className="box-title">Impact</span>
                  <span className="box-value">{selectedFeature.impact_score.toFixed(1)}/10</span>
                  <span className="box-desc">Customer value estimation</span>
                </div>
                <div className="metric-box">
                  <span className="box-title">Confidence</span>
                  <span className="box-value">{selectedFeature.rice_confidence.toFixed(0)}%</span>
                  <span className="box-desc">Estimation reliability</span>
                </div>
                <div className="metric-box">
                  <span className="box-title">Effort Score</span>
                  <span className="box-value">{selectedFeature.effort_score.toFixed(1)}/10</span>
                  <span className="box-desc">Development complexity</span>
                </div>
                <div className="metric-box">
                  <span className="box-title">Risk Score</span>
                  <span className="box-value">{selectedFeature.risk_score.toFixed(1)}/10</span>
                  <span className="box-desc">Stability/Security risk</span>
                </div>
                <div className="metric-box">
                  <span className="box-title">ROI Score</span>
                  <span className="box-value" style={{ color: 'var(--color-success)' }}>
                    {selectedFeature.roi_score.toFixed(1)}
                  </span>
                  <span className="box-desc">Value to cost ratio</span>
                </div>
              </div>

              {/* Framework Rankings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1.5rem 0' }}>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>RICE Priorities</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>RICE Score:</span>
                    <strong style={{ fontSize: '1.25rem' }}>{selectedFeature.rice_score.toFixed(1)}</strong>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>MoSCoW Bracket</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>MoSCoW status:</span>
                    <span className={`moscow-badge moscow-${selectedFeature.moscow_category.toLowerCase().replace(' ', '-')}`}>
                      {selectedFeature.moscow_category}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI generated business recommendation */}
              <div className="detail-section recommendation-section glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                  <span>💡</span>
                  <h4 style={{ margin: 0, color: '#c084fc' }}>AI Business Recommendation</h4>
                </div>
                <p style={{ fontStyle: 'italic', lineHeight: '1.6' }}>
                  "{selectedFeature.business_recommendation}"
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Overall Priority: <strong>{selectedFeature.priority_class}</strong> (Score: {selectedFeature.priority_score.toFixed(1)})
              </span>
              <button className="action-btn" onClick={() => setSelectedFeature(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrioritizationPage;
