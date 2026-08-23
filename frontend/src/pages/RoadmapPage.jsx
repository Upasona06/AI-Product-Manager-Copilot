import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const RoadmapPage = () => {
  const { user } = useContext(AuthContext);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [activeTab, setActiveTab] = useState('board'); // 'board' or 'milestones'

  // Filter states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [moscowFilter, setMoscowFilter] = useState('');

  // Editing release target details for each column
  const [releaseTargets, setReleaseTargets] = useState({
    now: { milestone_name: '', target_date: '', notes: '', editing: false },
    next: { milestone_name: '', target_date: '', notes: '', editing: false },
    later: { milestone_name: '', target_date: '', notes: '', editing: false }
  });

  // Detailed Modal overlay
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureNotes, setFeatureNotes] = useState('');

  const fetchRoadmapData = async () => {
    if (!user || !user.project_id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/roadmap?project_id=${user.project_id}`);
      if (response.data.success) {
        const fetched = response.data.data;
        setFeatures(fetched);

        // Pre-populate release target inputs based on first items found in each column
        const newTargets = {
          now: { milestone_name: '', target_date: '', notes: '', editing: false },
          next: { milestone_name: '', target_date: '', notes: '', editing: false },
          later: { milestone_name: '', target_date: '', notes: '', editing: false }
        };

        ['now', 'next', 'later'].forEach(h => {
          const match = fetched.find(f => f.horizon === h && f.roadmap_item);
          if (match && match.roadmap_item) {
            newTargets[h] = {
              milestone_name: match.roadmap_item.milestone_name || '',
              target_date: match.roadmap_item.target_date || '',
              notes: match.roadmap_item.notes || '',
              editing: false
            };
          }
        });
        setReleaseTargets(newTargets);
      } else {
        setError(response.data.error || "Failed to load roadmap.");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Failed to retrieve roadmap items from server.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmapData();
  }, [user]);

  const handleUpdateHorizon = async (prioritizationId, newHorizon) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const targetMeta = releaseTargets[newHorizon] || {};
      const response = await api.post('/api/roadmap/update', {
        project_id: user.project_id,
        prioritization_id: prioritizationId,
        horizon: newHorizon,
        milestone_name: targetMeta.milestone_name || "",
        target_date: targetMeta.target_date || "",
        notes: targetMeta.notes || ""
      });

      if (response.data.success) {
        setFeatures(prev =>
          prev.map(f => {
            if (f.prioritization_id === prioritizationId) {
              return {
                ...f,
                horizon: newHorizon,
                roadmap_item: response.data.data
              };
            }
            return f;
          })
        );
        setSuccessMsg(`Successfully moved feature to "${newHorizon.toUpperCase()}"`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(response.data.error || "Failed to update feature position.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to communicate with server to update roadmap.");
    }
  };

  const handleSaveColumnTargets = async (horizon) => {
    setError(null);
    setSuccessMsg(null);
    const target = releaseTargets[horizon];
    try {
      const response = await api.post('/api/roadmap/update-column', {
        project_id: user.project_id,
        horizon: horizon,
        milestone_name: target.milestone_name,
        target_date: target.target_date,
        notes: target.notes
      });

      if (response.data.success) {
        setFeatures(prev =>
          prev.map(f => {
            if (f.horizon === horizon || (f.horizon === undefined && horizon === 'now')) {
              return {
                ...f,
                roadmap_item: {
                  ...(f.roadmap_item || {}),
                  milestone_name: target.milestone_name,
                  target_date: target.target_date,
                  notes: target.notes
                }
              };
            }
            return f;
          })
        );
        setReleaseTargets(prev => ({
          ...prev,
          [horizon]: { ...prev[horizon], editing: false }
        }));
        setSuccessMsg(`Saved target release details for "${horizon.toUpperCase()}"`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(response.data.error || "Failed to save release details.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save release details to server.");
    }
  };

  const handleSaveFeatureNotes = async () => {
    if (!selectedFeature) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await api.post('/api/roadmap/update', {
        project_id: user.project_id,
        prioritization_id: selectedFeature.prioritization_id,
        horizon: selectedFeature.horizon || 'now',
        milestone_name: selectedFeature.roadmap_item?.milestone_name || '',
        target_date: selectedFeature.roadmap_item?.target_date || '',
        notes: featureNotes
      });

      if (response.data.success) {
        setFeatures(prev =>
          prev.map(f => {
            if (f.prioritization_id === selectedFeature.prioritization_id) {
              return {
                ...f,
                roadmap_item: response.data.data
              };
            }
            return f;
          })
        );
        setSelectedFeature(prev => ({
          ...prev,
          roadmap_item: response.data.data
        }));
        setSuccessMsg("Updated feature notes successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(response.data.error || "Failed to update feature notes.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save feature notes to server.");
    }
  };

  const handleGenerateRecommendations = async () => {
    setRecommendationLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await api.get(`/api/roadmap/recommendations?project_id=${user.project_id}`);
      if (response.data.success) {
        setMilestones(response.data.data || []);
        setActiveTab('milestones');
        setSuccessMsg("Generated AI release milestone sequences based on prioritized requirements.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(response.data.error || "Failed to generate recommendations.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to generate release recommendations.");
    } finally {
      setRecommendationLoading(false);
    }
  };

  const handleApplyRecommendations = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await api.post('/api/roadmap/apply-recommendations', {
        project_id: user.project_id,
        milestones: milestones
      });
      if (response.data.success) {
        setSuccessMsg("Applied AI Milestone schedule directly to your active Roadmap.");
        setActiveTab('board');
        fetchRoadmapData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(response.data.error || "Failed to apply recommendations.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to apply milestone sequence.");
    }
  };

  // Filter features based on search & tags
  const filteredFeatures = features.filter(f => {
    const matchesSearch = search === '' ||
      (f.feature_name && f.feature_name.toLowerCase().includes(search.toLowerCase())) ||
      (f.description && f.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === '' || (f.processed_feedback?.category === categoryFilter);
    const matchesMoscow = moscowFilter === '' || f.moscow_category === moscowFilter;

    return matchesSearch && matchesCategory && matchesMoscow;
  });

  // Organize by horizon
  const horizonColumns = {
    now: filteredFeatures.filter(f => !f.horizon || f.horizon === 'now'),
    next: filteredFeatures.filter(f => f.horizon === 'next'),
    later: filteredFeatures.filter(f => f.horizon === 'later')
  };

  // Helper for status badge
  const getMoscowBadgeClass = (cat) => {
    switch (cat) {
      case 'Must Have': return 'priority-high';
      case 'Should Have': return 'priority-medium';
      case 'Could Have': return 'category-feature';
      default: return 'category-general';
    }
  };

  // Calculate MoSCoW distribution percentages for progress bar
  const getMoscowDistribution = (items) => {
    if (!items.length) return { must: 0, should: 0, could: 0, wont: 0 };
    const total = items.length;
    const must = Math.round((items.filter(i => i.moscow_category === 'Must Have').length / total) * 100);
    const should = Math.round((items.filter(i => i.moscow_category === 'Should Have').length / total) * 100);
    const could = Math.round((items.filter(i => i.moscow_category === 'Could Have').length / total) * 100);
    const wont = Math.round((items.filter(i => i.moscow_category === "Won't Have").length / total) * 100);
    return { must, should, could, wont };
  };

  // Statistics KPI calculations
  const totalPlanned = features.length;
  const nowCount = horizonColumns.now.length;
  const mustHaveNow = horizonColumns.now.filter(f => f.moscow_category === 'Must Have').length;
  const mvpReadiness = nowCount > 0 ? Math.round((mustHaveNow / nowCount) * 100) : 0;
  const avgRoiNow = nowCount > 0 
    ? (horizonColumns.now.reduce((acc, curr) => acc + (parseFloat(curr.roi_score) || 0), 0) / nowCount).toFixed(1)
    : 0;

  return (
    <div className="page-layout">
      {/* Header section */}
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div className="header-meta">
          <h1>🗺️ Dynamic Product Roadmap</h1>
          <p>Organize prioritized feedback into Now, Next, and Later release horizons with AI milestone grouping.</p>
        </div>

        {/* Tab & Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => setActiveTab('board')}
              style={{
                background: activeTab === 'board' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'board' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📋 Horizon Board
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              style={{
                background: activeTab === 'milestones' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'milestones' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💡 AI Milestone Sequences
            </button>
          </div>

          <button
            onClick={handleGenerateRecommendations}
            disabled={recommendationLoading || features.length === 0}
            className="action-btn"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            {recommendationLoading ? "✨ Grouping Releases..." : "✨ AI Group Milestones"}
          </button>
        </div>
      </div>

      {/* KPI Panel */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-icon">📋</div>
          <div className="metric-data">
            <span className="metric-value">{totalPlanned}</span>
            <span className="metric-label">Planned Features</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon">🏆</div>
          <div className="metric-data">
            <span className="metric-value">{mvpReadiness}%</span>
            <span className="metric-label">MVP Readiness (Must Haves Now)</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon">🔥</div>
          <div className="metric-data">
            <span className="metric-value">{avgRoiNow}</span>
            <span className="metric-label">Avg ROI Score (Now)</span>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="filter-toolbar glass-panel" style={{ padding: '1.25rem', marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: '1' }}>
          <input 
            type="text" 
            placeholder="Search planned features..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              minWidth: '240px',
              outline: 'none'
            }}
          />

          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-secondary)',
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

          <select 
            value={moscowFilter} 
            onChange={(e) => setMoscowFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-secondary)',
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
      </div>

      {/* Messages */}
      {error && (
        <div className="alert-message error-alert" style={{ margin: '0 0 2rem 0' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-message success-alert" style={{ margin: '0 0 2rem 0' }}>
          <span>✅ {successMsg}</span>
        </div>
      )}

      {/* Main Roadmap Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <p>Loading roadmap plans and feature release horizons...</p>
        </div>
      ) : activeTab === 'board' ? (
        /* Kanban Board for Now / Next / Later */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'flex-start' }}>
          {['now', 'next', 'later'].map(col => {
            const list = horizonColumns[col] || [];
            const target = releaseTargets[col] || {};
            const dist = getMoscowDistribution(list);

            return (
              <div 
                key={col} 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: '650px', 
                  padding: '1.5rem',
                  background: 'var(--glass-bg)'
                }}
              >
                {/* Column header */}
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: col === 'now' ? '#ef4444' : col === 'next' ? '#f59e0b' : '#10b981' 
                        }}
                      ></span>
                      <h3 style={{ textTransform: 'capitalize', fontWeight: '700', fontSize: '1.2rem' }}>{col}</h3>
                    </div>
                    <span className="badge category-general" style={{ fontSize: '0.75rem', textTransform: 'lowercase' }}>
                      {list.length} items
                    </span>
                  </div>

                  {/* Column Metadata / Targets */}
                  <div style={{ marginTop: '0.75rem' }}>
                    {target.editing ? (
                      <div className="standard-form" style={{ gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Release version (e.g. v1.0)"
                          value={target.milestone_name}
                          onChange={(e) => setReleaseTargets(prev => ({
                            ...prev,
                            [col]: { ...prev[col], milestone_name: e.target.value }
                          }))}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                        />
                        <input
                          type="text"
                          placeholder="Target Date (e.g. Oct 2026)"
                          value={target.target_date}
                          onChange={(e) => setReleaseTargets(prev => ({
                            ...prev,
                            [col]: { ...prev[col], target_date: e.target.value }
                          }))}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                        />
                        <textarea
                          placeholder="Milestone goal..."
                          rows={2}
                          value={target.notes}
                          onChange={(e) => setReleaseTargets(prev => ({
                            ...prev,
                            [col]: { ...prev[col], notes: e.target.value }
                          }))}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <button 
                            onClick={() => handleSaveColumnTargets(col)} 
                            className="action-btn"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setReleaseTargets(prev => ({
                              ...prev,
                              [col]: { ...prev[col], editing: false }
                            }))}
                            className="logout-btn"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--glass-bg)', padding: '0.6rem 0.8rem', borderRadius: 'var(--border-radius-sm)', marginTop: '0.5rem', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {target.milestone_name || 'No Target Release'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#c084fc' }}>
                            {target.target_date || 'TBD'}
                          </span>
                        </div>
                        {target.notes && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.25rem' }}>
                            {target.notes}
                          </div>
                        )}
                        <button
                          onClick={() => setReleaseTargets(prev => ({
                            ...prev,
                            [col]: { ...prev[col], editing: true }
                          }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            marginTop: '0.4rem',
                            padding: '0'
                          }}
                        >
                          ✏️ Edit Targets
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MoSCoW Release Composition Bar */}
                  {list.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        <span>Composition Breakdown</span>
                        <span>M/S/C</span>
                      </div>
                      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--glass-border)' }}>
                        <div style={{ width: `${dist.must}%`, background: '#ef4444' }} title={`Must Have: ${dist.must}%`}></div>
                        <div style={{ width: `${dist.should}%`, background: '#f59e0b' }} title={`Should Have: ${dist.should}%`}></div>
                        <div style={{ width: `${dist.could}%`, background: '#3b82f6' }} title={`Could Have: ${dist.could}%`}></div>
                        <div style={{ width: `${dist.wont}%`, background: '#6b7280' }} title={`Won't Have: ${dist.wont}%`}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: '1', overflowY: 'auto' }}>
                  {list.length === 0 ? (
                    <div style={{ 
                      flex: '1', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      border: '1.5px dashed var(--glass-border)', 
                      borderRadius: 'var(--border-radius-md)', 
                      padding: '2rem', 
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      fontSize: '0.9rem'
                    }}>
                      No features matching filters in this horizon.
                    </div>
                  ) : (
                    list.map(f => (
                      <div 
                        key={f.prioritization_id}
                        className="glass-panel"
                        onClick={() => {
                          setSelectedFeature(f);
                          setFeatureNotes(f.roadmap_item?.notes || '');
                        }}
                        style={{ 
                          padding: '1.1rem', 
                          background: 'var(--bg-secondary)', 
                          border: '1px solid var(--glass-border)',
                          cursor: 'pointer',
                          borderRadius: 'var(--border-radius-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {f.feature_name}
                          </h4>
                          <span className={`badge ${getMoscowBadgeClass(f.moscow_category)}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                            {f.moscow_category}
                          </span>
                        </div>

                        <p className="description-preview" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.75rem', minHeight: '38px' }}>
                          {f.description || "No description provided."}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                          <span className="status-tag">RICE: {f.rice_score}</span>
                          <span className="status-tag">ROI: {f.roi_score}</span>
                          <span className="status-tag" style={{ borderLeft: f.priority_class === 'High' ? '2px solid var(--color-error)' : '1px solid var(--glass-border)' }}>
                            {f.priority_class}
                          </span>
                        </div>

                        <div 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            borderTop: '1px solid var(--glass-border)', 
                            paddingTop: '0.6rem' 
                          }}
                          onClick={(e) => e.stopPropagation()} // Stop modal from triggering
                        >
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Move:</span>
                          <select
                            value={col}
                            onChange={(e) => handleUpdateHorizon(f.prioritization_id, e.target.value)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--glass-border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="now">Now</option>
                            <option value="next">Next</option>
                            <option value="later">Later</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Milestone Recommendations Tab */
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--accent-primary)', marginBottom: '2rem', background: 'rgba(124,58,237,0.03)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
              💡 Copilot Release Milestone Sequences
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0' }}>
              We analyzed the prioritized feedback and grouped requirements into a recommended launch sequence. 
              The layout clusters features to deliver maximum immediate value in Release 1, followed by secondary enhancements.
            </p>
            <button
              onClick={handleApplyRecommendations}
              disabled={milestones.length === 0}
              className="action-btn"
              style={{ 
                alignSelf: 'start', 
                marginTop: '0.5rem',
                opacity: milestones.length === 0 ? 0.6 : 1,
                cursor: milestones.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              🚀 Apply Milestone Structure to Roadmap
            </button>
            {milestones.length === 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                💡 Click the <strong>✨ AI Group Milestones</strong> button at the top to generate sequences first.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {milestones.map((m, index) => (
              <div key={index} className="glass-panel" style={{ border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className="badge priority-low" style={{ textTransform: 'none', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)' }}>
                    Release Horizon: {m.target_date}
                  </span>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '700' }}>{m.name}</h3>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', marginBottom: '1.25rem' }}>
                  <strong style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Core Release Goal:</strong>
                  <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', margin: '0.25rem 0 0 0' }}>{m.goal}</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>
                    {m.description}
                  </span>
                </div>

                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Grouped Features ({m.feature_ids?.length || 0})
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {m.feature_ids?.map(fid => {
                    const featureObj = features.find(f => f.prioritization_id === fid);
                    if (!featureObj) return null;
                    return (
                      <div key={fid} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{featureObj.feature_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>ROI: {featureObj.roi_score} | RICE: {featureObj.rice_score}</div>
                        </div>
                        <span className={`badge ${getMoscowBadgeClass(featureObj.moscow_category)}`} style={{ fontSize: '0.68rem' }}>
                          {featureObj.moscow_category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Detailed Inspection & Notes Modal */}
      {selectedFeature && (
        <div 
          onClick={() => setSelectedFeature(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 5, 8, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <div>
                <span className={`badge ${getMoscowBadgeClass(selectedFeature.moscow_category)}`} style={{ marginBottom: '0.5rem' }}>
                  {selectedFeature.moscow_category}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedFeature.feature_name}</h2>
              </div>
              <button 
                onClick={() => setSelectedFeature(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  lineHeight: '1',
                  padding: '0'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Requirement Description</h4>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {selectedFeature.description || "No description provided."}
                </p>
              </div>

              {/* RICE metrics breakdown */}
              <div>
                <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Prioritization Scoring Breakdown</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RICE Reach (Weight)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{selectedFeature.rice_reach || 1}</div>
                  </div>
                  <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RICE Impact</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{selectedFeature.rice_impact}</div>
                  </div>
                  <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RICE Confidence</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{selectedFeature.rice_confidence}%</div>
                  </div>
                  <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RICE Effort</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{selectedFeature.rice_effort}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>Return on Investment (ROI)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-success)', marginTop: '0.2rem' }}>{selectedFeature.roi_score}</div>
                  </div>
                  <div style={{ background: 'rgba(124, 58, 237, 0.08)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(124, 58, 237, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Overall Priority Score</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>{selectedFeature.priority_score}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>AI Copilot Strategic Recommendation</h4>
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {selectedFeature.business_recommendation || "No recommendation available."}
                </div>
              </div>

              <div className="standard-form">
                <div className="form-group">
                  <label htmlFor="modalNotes">Release Notes & Implementation Tasks</label>
                  <textarea
                    id="modalNotes"
                    rows={4}
                    value={featureNotes}
                    onChange={(e) => setFeatureNotes(e.target.value)}
                    placeholder="Add tasks, milestones alignment, or technical specifications for this release..."
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                  <button 
                    onClick={handleSaveFeatureNotes} 
                    className="action-btn"
                  >
                    Save Notes
                  </button>
                  <button 
                    onClick={() => setSelectedFeature(null)} 
                    className="logout-btn"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapPage;
