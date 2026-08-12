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
          
          if (cat.includes("bug")) localCategoryStats.bug += 1;
          else if (cat.includes("feature")) localCategoryStats.feature += 1;
          else if (cat.includes("complaint")) localCategoryStats.complaint += 1;
          else if (cat.includes("improvement")) localCategoryStats.improvement += 1;

          if (sent.includes("positive")) localSentimentStats.positive += 1;
          else if (sent.includes("neutral")) localSentimentStats.neutral += 1;
          else if (sent.includes("negative")) localSentimentStats.negative += 1;
          else if (sent.includes("mixed")) localSentimentStats.mixed += 1;
        });

        // Sum weights to calculate duplicates
        duplicateMatchesCount = rawClassified.reduce((acc, curr) => acc + ((curr.weight || 1) - 1), 0);
      }

      setCategoryStats(localCategoryStats);
      setSentimentStats(localSentimentStats);
      
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
