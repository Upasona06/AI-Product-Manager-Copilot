import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';

const DashboardPage = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    processed: 0,
    duplicate: 0,
    failed: 0
  });
  
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [classifiedData, setClassifiedData] = useState([]);
  const [categoryStats, setCategoryStats] = useState({
    bug: 0,
    feature: 0,
    complaint: 0,
    improvement: 0
  });
  const [sentimentStats, setSentimentStats] = useState({
    positive: 0,
    neutral: 0,
    negative: 0,
    mixed: 0
  });
  const [priorityStats, setPriorityStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [moscowStats, setMoscowStats] = useState({
    must: 0,
    should: 0,
    could: 0,
    wont: 0
  });
  const [totalFeatures, setTotalFeatures] = useState(0);

  const [heatmapMatrix, setHeatmapMatrix] = useState({
    bug: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
    feature: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
    complaint: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
    improvement: { positive: 0, neutral: 0, mixed: 0, negative: 0 }
  });
  const [maxHeatmapVal, setMaxHeatmapVal] = useState(1);
  const [trendData, setTrendData] = useState([]);

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStatusMsg, setPipelineStatusMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch processing results for project
      const resultsRes = await api.get(`/api/process/results?project_id=${user.project_id}&page_size=10`);
      if (resultsRes.data.success) {
        setRecentFeedbacks(resultsRes.data.data.results);
      }
      
      const rawCount = resultsRes.data.data.total;
      
      // 2. Fetch classified results for project to build charts
      const classifyRes = await api.get(`/api/classification/results?project_id=${user.project_id}`);
      let localCategoryStats = { bug: 0, feature: 0, complaint: 0, improvement: 0 };
      let localSentimentStats = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
      let localPriorityStats = { critical: 0, high: 0, medium: 0, low: 0 };
      let duplicateMatchesCount = 0;

      if (classifyRes.data.success) {
        const rawClassified = Array.isArray(classifyRes.data.data)
          ? classifyRes.data.data
          : (classifyRes.data.data?.results || []);
        
        setClassifiedData(rawClassified);

        // Aggregate statistics
        rawClassified.forEach(item => {
          const cat = (item.ai_category || item.category || "").toLowerCase();
          const sent = (item.ai_sentiment || item.sentiment || "").toLowerCase();
          const prio = (item.priority || "medium").toLowerCase();
          
          if (cat.includes("bug")) localCategoryStats.bug += 1;
          else if (cat.includes("feature")) localCategoryStats.feature += 1;
          else if (cat.includes("complaint")) localCategoryStats.complaint += 1;
          else if (cat.includes("improvement")) localCategoryStats.improvement += 1;

          if (sent.includes("positive")) localSentimentStats.positive += 1;
          else if (sent.includes("neutral")) localSentimentStats.neutral += 1;
          else if (sent.includes("negative")) localSentimentStats.negative += 1;
          else if (sent.includes("mixed")) localSentimentStats.mixed += 1;

          if (prio.includes("critical")) localPriorityStats.critical += 1;
          else if (prio.includes("high")) localPriorityStats.high += 1;
          else if (prio.includes("low")) localPriorityStats.low += 1;
          else localPriorityStats.medium += 1; // Default to medium
        });

        // Heatmap Matrix Aggregation
        let localHeatmap = {
          bug: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
          feature: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
          complaint: { positive: 0, neutral: 0, mixed: 0, negative: 0 },
          improvement: { positive: 0, neutral: 0, mixed: 0, negative: 0 }
        };
        let maxVal = 1;

        rawClassified.forEach(item => {
          const cat = (item.ai_category || item.category || "").toLowerCase();
          const sent = (item.ai_sentiment || item.sentiment || "").toLowerCase();
          
          let catKey = null;
          if (cat.includes("bug")) catKey = "bug";
          else if (cat.includes("feature")) catKey = "feature";
          else if (cat.includes("complaint")) catKey = "complaint";
          else if (cat.includes("improvement")) catKey = "improvement";

          let sentKey = null;
          if (sent.includes("positive")) sentKey = "positive";
          else if (sent.includes("neutral")) sentKey = "neutral";
          else if (sent.includes("mixed")) sentKey = "mixed";
          else if (sent.includes("negative")) sentKey = "negative";

          if (catKey && sentKey) {
            localHeatmap[catKey][sentKey] += 1;
            if (localHeatmap[catKey][sentKey] > maxVal) {
              maxVal = localHeatmap[catKey][sentKey];
            }
          }
        });
        setHeatmapMatrix(localHeatmap);
        setMaxHeatmapVal(maxVal);

        // Ingestion Trend (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0];
        }).reverse();

        let localTrend = {};
        last7Days.forEach(date => {
          localTrend[date] = 0;
        });

        rawClassified.forEach(item => {
          if (item.created_at) {
            const dateStr = item.created_at.split('T')[0];
            if (localTrend[dateStr] !== undefined) {
              localTrend[dateStr] += 1;
            }
          }
        });

        const formattedTrend = last7Days.map(date => {
          const formattedDate = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return { date: formattedDate, count: localTrend[date] };
        });
        setTrendData(formattedTrend);

        // Sum weights to calculate duplicates
        duplicateMatchesCount = rawClassified.reduce((acc, curr) => acc + ((curr.weight || 1) - 1), 0);
      }

      setCategoryStats(localCategoryStats);
      setSentimentStats(localSentimentStats);
      setPriorityStats(localPriorityStats);
      
      // 3. Fetch prioritized backlog for MoSCoW breakdown
      let localMoscowStats = { must: 0, should: 0, could: 0, wont: 0 };
      try {
        const prioritizeRes = await api.get(`/api/prioritize/results?project_id=${user.project_id}&page_size=1000`);
        if (prioritizeRes.data.success) {
          const featuresList = prioritizeRes.data.data.results || [];
          setTotalFeatures(prioritizeRes.data.data.total || featuresList.length);
          
          featuresList.forEach(f => {
            const m = (f.moscow_category || "").toLowerCase();
            if (m.includes("must")) localMoscowStats.must += 1;
            else if (m.includes("should")) localMoscowStats.should += 1;
            else if (m.includes("could")) localMoscowStats.could += 1;
            else if (m.includes("wont") || m.includes("won't")) localMoscowStats.wont += 1;
          });
        }
      } catch (err) {
        console.error("Failed to load prioritized backlog features for dashboard:", err);
      }
      setMoscowStats(localMoscowStats);
      
      setStats({
        pending: 0,
        processing: 0,
        processed: rawCount,
        duplicate: duplicateMatchesCount || resultsRes.data.data.results.reduce((acc, curr) => acc + (curr.weight - 1), 0),
        failed: 0
      });
      
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch recent processed results. Verify backend service is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.project_id) {
      fetchDashboardData();
    }
  }, [user]);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineStatusMsg("Initiating Pipeline...");
    
    try {
      const response = await api.post('/api/process/run', { project_id: user.project_id });
      if (response.data.success) {
        const { job_id, pending_count } = response.data.data;
        if (pending_count === 0) {
          setPipelineStatusMsg("No pending feedback found to process.");
        } else {
          setPipelineStatusMsg(`Pipeline running in background. Job ID: ${job_id}. Processing ${pending_count} items...`);
          setTimeout(() => {
            fetchDashboardData();
            setPipelineStatusMsg(null);
          }, 5000);
        }
      }
    } catch (err) {
      console.error(err);
      setPipelineStatusMsg(null);
      setError(err.response?.data?.error || "Failed to trigger NLP pipeline.");
    } finally {
      setPipelineRunning(false);
    }
  };

  const totalClassified = classifiedData.length;
  const getPercentage = (value) => {
    if (totalClassified === 0) return 0;
    return Math.round((value / totalClassified) * 100);
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p>Loading Dashboard Analytics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container page-layout">
      <div className="dashboard-header">
        <div className="header-meta">
          <h1>Product Manager Command Panel</h1>
          <p className="project-token"><strong>Active Project ID:</strong> {user.project_id}</p>
        </div>
        
        <button 
          onClick={handleRunPipeline} 
          className="action-btn run-pipeline-btn"
          disabled={pipelineRunning}
        >
          {pipelineRunning ? "Executing Pipeline..." : "⚡ Run NLP Preprocessing"}
        </button>
      </div>

      {pipelineStatusMsg && (
        <div className="alert-message info-alert">
          <strong>Pipeline Run Status: </strong> {pipelineStatusMsg}
        </div>
      )}

      {error && (
        <div className="alert-message error-alert">
          <strong>Analytics Warning: </strong> {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <span className="metric-icon">📝</span>
          <div className="metric-data">
            <span className="metric-value">{stats.processed}</span>
            <span className="metric-label">Canonical Issues</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <span className="metric-icon">👥</span>
          <div className="metric-data">
            <span className="metric-value">{stats.duplicate}</span>
            <span className="metric-label">Duplicate Matches</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <span className="metric-icon">⚡</span>
          <div className="metric-data">
            <span className="metric-value">{recentFeedbacks.reduce((acc, curr) => acc + curr.weight, 0)}</span>
            <span className="metric-label">Total Submissions (Weight)</span>
          </div>
        </div>
      </div>

      {/* Dashboard Visual Charts */}
      {totalClassified > 0 && (
        <div className="dashboard-charts-grid">
          {/* Chart 1: Category Breakdown */}
          <div className="chart-card glass-panel">
            <h3>Feedback Category Breakdown</h3>
            <p className="chart-subtitle">Distribution of classified requests ({totalClassified} items)</p>
            <div className="chart-content">
              {/* Custom SVG Donut Chart */}
              <div className="svg-chart-container">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Segment 1: Bug (Red) */}
                  {categoryStats.bug > 0 && (
                    <path className="circle segment-bug"
                      strokeDasharray={`${getPercentage(categoryStats.bug)}, 100`}
                      strokeDashoffset="0"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  {/* Segment 2: Feature (Purple) */}
                  {categoryStats.feature > 0 && (
                    <path className="circle segment-feature"
                      strokeDasharray={`${getPercentage(categoryStats.feature)}, 100`}
                      strokeDashoffset={`-${getPercentage(categoryStats.bug)}`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  {/* Segment 3: Complaint (Orange) */}
                  {categoryStats.complaint > 0 && (
                    <path className="circle segment-complaint"
                      strokeDasharray={`${getPercentage(categoryStats.complaint)}, 100`}
                      strokeDashoffset={`-${getPercentage(categoryStats.bug) + getPercentage(categoryStats.feature)}`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  {/* Segment 4: Improvement (Green) */}
                  {categoryStats.improvement > 0 && (
                    <path className="circle segment-improvement"
                      strokeDasharray={`${getPercentage(categoryStats.improvement)}, 100`}
                      strokeDashoffset={`-${getPercentage(categoryStats.bug) + getPercentage(categoryStats.feature) + getPercentage(categoryStats.complaint)}`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  <text x="18" y="20.35" className="percentage-text">{totalClassified}</text>
                </svg>
              </div>

              {/* Legends & Mini Progress */}
              <div className="chart-legend-grid">
                <div className="legend-item">
                  <div className="legend-title-container">
                    <span className="dot dot-bug"></span>
                    <span className="legend-title">Bugs</span>
                  </div>
                  <span className="legend-percentage">{getPercentage(categoryStats.bug)}% ({categoryStats.bug})</span>
                </div>
                <div className="legend-item">
                  <div className="legend-title-container">
                    <span className="dot dot-feature"></span>
                    <span className="legend-title">Features</span>
                  </div>
                  <span className="legend-percentage">{getPercentage(categoryStats.feature)}% ({categoryStats.feature})</span>
                </div>
                <div className="legend-item">
                  <div className="legend-title-container">
                    <span className="dot dot-complaint"></span>
                    <span className="legend-title">Complaints</span>
                  </div>
                  <span className="legend-percentage">{getPercentage(categoryStats.complaint)}% ({categoryStats.complaint})</span>
                </div>
                <div className="legend-item">
                  <div className="legend-title-container">
                    <span className="dot dot-improvement"></span>
                    <span className="legend-title">Improvements</span>
                  </div>
                  <span className="legend-percentage">{getPercentage(categoryStats.improvement)}% ({categoryStats.improvement})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Sentiment Distribution */}
          <div className="chart-card glass-panel">
            <h3>Sentiment Summary</h3>
            <p className="chart-subtitle">Self-reported and AI analyzed customer sentiment</p>
            <div className="chart-content vertical-center">
              
              {/* Stacked Ratio Pill Bar */}
              <div className="ratio-bar-container">
                <div className="ratio-bar">
                  {sentimentStats.positive > 0 && (
                    <div className="ratio-segment segment-pos" style={{ width: `${getPercentage(sentimentStats.positive)}%` }} title="Positive"></div>
                  )}
                  {sentimentStats.neutral > 0 && (
                    <div className="ratio-segment segment-neu" style={{ width: `${getPercentage(sentimentStats.neutral)}%` }} title="Neutral"></div>
                  )}
                  {sentimentStats.mixed > 0 && (
                    <div className="ratio-segment segment-mix" style={{ width: `${getPercentage(sentimentStats.mixed)}%` }} title="Mixed"></div>
                  )}
                  {sentimentStats.negative > 0 && (
                    <div className="ratio-segment segment-neg" style={{ width: `${getPercentage(sentimentStats.negative)}%` }} title="Negative"></div>
                  )}
                </div>
              </div>

              {/* Progress Bars for Sentiments */}
              <div className="sentiment-progress-list">
                <div className="sentiment-progress-row">
                  <div className="sentiment-progress-meta">
                    <span>🟢 Positive</span>
                    <strong>{getPercentage(sentimentStats.positive)}%</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill fill-positive" style={{ width: `${getPercentage(sentimentStats.positive)}%` }}></div>
                  </div>
                </div>
                <div className="sentiment-progress-row">
                  <div className="sentiment-progress-meta">
                    <span>🔵 Neutral</span>
                    <strong>{getPercentage(sentimentStats.neutral)}%</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill fill-neutral" style={{ width: `${getPercentage(sentimentStats.neutral)}%` }}></div>
                  </div>
                </div>
                <div className="sentiment-progress-row">
                  <div className="sentiment-progress-meta">
                    <span>🟡 Mixed</span>
                    <strong>{getPercentage(sentimentStats.mixed)}%</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill fill-mixed" style={{ width: `${getPercentage(sentimentStats.mixed)}%` }}></div>
                  </div>
                </div>
                <div className="sentiment-progress-row">
                  <div className="sentiment-progress-meta">
                    <span>🔴 Negative</span>
                    <strong>{getPercentage(sentimentStats.negative)}%</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill fill-negative" style={{ width: `${getPercentage(sentimentStats.negative)}%` }}></div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Chart 3: Feedback Priority */}
          <div className="chart-card glass-panel">
            <h3>Priority Distribution</h3>
            <p className="chart-subtitle">Priority weightings of user submissions ({totalClassified} items)</p>
            <div className="chart-content vertical-center" style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '0 0.5rem' }}>
                {[
                  { name: 'Critical', value: priorityStats.critical, color: '#ef4444' },
                  { name: 'High', value: priorityStats.high, color: '#f97316' },
                  { name: 'Medium', value: priorityStats.medium, color: '#eab308' },
                  { name: 'Low', value: priorityStats.low, color: '#3b82f6' }
                ].map((item, idx) => {
                  const pct = totalClassified > 0 ? Math.round((item.value / totalClassified) * 100) : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{item.name}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{item.value} ({pct}%)</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart 4: MoSCoW Prioritization */}
          <div className="chart-card glass-panel">
            <h3>MoSCoW Backlog Breakdown</h3>
            <p className="chart-subtitle">Categorization of feature backlog items ({totalFeatures} features)</p>
            <div className="chart-content vertical-center" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                {[
                  { name: 'Must Have', value: moscowStats.must, color: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)', desc: 'Critical requirements' },
                  { name: 'Should Have', value: moscowStats.should, color: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', desc: 'High priority features' },
                  { name: 'Could Have', value: moscowStats.could, color: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', desc: 'Desirable improvements' },
                  { name: 'Won\'t Have', value: moscowStats.wont, color: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', desc: 'Deferred items' }
                ].map((item, idx) => (
                  <div key={idx} style={{ 
                    background: item.color, 
                    border: `1px solid ${item.border}`, 
                    borderRadius: '12px', 
                    padding: '0.85rem 1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    gap: '0.25rem'
                  }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.desc}</span>
                    </div>
                    <strong style={{ fontSize: '1.75rem', color: item.text, display: 'block', marginTop: '0.25rem' }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 5: Category-Sentiment Heatmap */}
          <div className="chart-card glass-panel">
            <h3>Category vs Sentiment Heatmap</h3>
            <p className="chart-subtitle">Cross-analysis of feedback category density and sentiments</p>
            <div className="chart-content vertical-center" style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                
                {/* Sentiment Header labels */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  <div></div>
                  <div>Positive</div>
                  <div>Neutral</div>
                  <div>Mixed</div>
                  <div>Negative</div>
                </div>

                {/* Heatmap Rows */}
                {[
                  { label: 'Bug 🐞', key: 'bug' },
                  { label: 'Feature 💡', key: 'feature' },
                  { label: 'Complaint ⚠️', key: 'complaint' },
                  { label: 'Improve 🚀', key: 'improvement' }
                ].map((row, rowIdx) => (
                  <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{row.label}</span>
                    {['positive', 'neutral', 'mixed', 'negative'].map((colKey, colIdx) => {
                      const count = heatmapMatrix[row.key]?.[colKey] || 0;
                      const opacity = totalClassified > 0 ? (count / maxHeatmapVal) * 0.85 + (count > 0 ? 0.15 : 0) : 0;
                      
                      return (
                        <div 
                          key={colIdx} 
                          title={`${row.label.split(' ')[0]} with ${colKey} sentiment: ${count} items`}
                          style={{
                            background: count > 0 ? `rgba(124, 58, 237, ${opacity})` : 'rgba(255,255,255,0.01)',
                            border: count > 0 ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: count > 0 ? '#fff' : 'var(--text-muted)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 6: Ingestion Trend Line Chart */}
          <div className="chart-card glass-panel">
            <h3>Ingestion Trend</h3>
            <p className="chart-subtitle">Volume of feedback processed over the last 7 days</p>
            <div className="chart-content vertical-center" style={{ width: '100%' }}>
              {trendData.length > 0 ? (
                <div style={{ width: '100%', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <svg viewBox="0 0 350 150" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>
                    
                    {/* Grid Lines */}
                    <line x1="0" y1="30" x2="350" y2="30" stroke="var(--glass-border)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="75" x2="350" y2="75" stroke="var(--glass-border)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="120" x2="350" y2="120" stroke="var(--glass-border)" strokeWidth="0.5" strokeDasharray="3" />

                    {/* Generate path points */}
                    {(() => {
                      const maxVal = Math.max(...trendData.map(d => d.count), 1);
                      const points = trendData.map((d, i) => {
                        const x = (i * 350) / (trendData.length - 1);
                        const y = 120 - (d.count * 90) / maxVal;
                        return { x, y, count: d.count };
                      });
                      
                      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const areaD = `${pathD} L ${points[points.length-1].x} 120 L ${points[0].x} 120 Z`;

                      return (
                        <>
                          {/* Area under line */}
                          <path d={areaD} fill="url(#trendGradient)" />
                          
                          {/* Line */}
                          <path d={pathD} fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
                          
                          {/* Circles & Labels */}
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-secondary)" stroke="var(--accent-primary)" strokeWidth="2" />
                              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontWeight="600">
                                {p.count}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  
                  {/* X Axis labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
                    {trendData.map((d, i) => (
                      <span key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {d.date}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No trend data available.</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Section Content */}
      <div className="recent-activity-section glass-panel">
        <div className="section-header">
          <h2>Recent Preprocessed Feedback</h2>
          <Link to="/status" className="view-all-link">View Detailed Status Table →</Link>
        </div>

        {recentFeedbacks.length === 0 ? (
          <div className="empty-state">
            <p>No feedback processed yet. Head to the <Link to="/upload/csv">CSV Ingestion Panel</Link> to import some data.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Weight</th>
                  <th>Word Count</th>
                  <th>Lemma Extract</th>
                </tr>
              </thead>
              <tbody>
                {recentFeedbacks.map((item) => (
                  <tr key={item.processed_id}>
                    <td>
                      <div className="subject-text">{item.original_subject}</div>
                      <div className="description-preview">{item.clean_text.substring(0, 75)}...</div>
                    </td>
                    <td>
                      <span className={`badge category-${item.category.toLowerCase().replace(' ', '-')}`}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span className={`badge priority-${item.priority.toLowerCase()}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td><strong>{item.weight}</strong></td>
                    <td>{item.word_count}</td>
                    <td>
                      <div className="lemmas-chips">
                        {item.lemmas.slice(0, 3).map((lemma, idx) => (
                          <span key={idx} className="lemma-chip">{lemma}</span>
                        ))}
                        {item.lemmas.length > 3 && <span className="lemma-more">+{item.lemmas.length - 3}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
