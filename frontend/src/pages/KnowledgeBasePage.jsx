import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const KnowledgeBasePage = () => {
  const { user } = useContext(AuthContext);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);

  // Index state
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState(null);
  const [indexError, setIndexError] = useState(null);

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Search history (localStorage)
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kb_search_history');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }, []);

  // Save search history to localStorage
  const saveToHistory = useCallback((queryText, resultCount) => {
    const entry = {
      query: queryText,
      resultCount,
      timestamp: new Date().toISOString(),
    };
    setSearchHistory(prev => {
      const updated = [entry, ...prev.filter(h => h.query !== queryText)].slice(0, 20);
      localStorage.setItem('kb_search_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Fetch stats on load
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/rag/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch KB stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Semantic Search
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSearchMeta(null);

    try {
      const res = await api.post('/rag/search', {
        query: query.trim(),
        project_id: user.project_id,
      });

      if (res.data.success) {
        setSearchResults(res.data.data.results || []);
        setSearchMeta({
          total: res.data.data.total_results,
          model: res.data.data.embedding_model,
          topK: res.data.data.top_k,
        });
        saveToHistory(query.trim(), res.data.data.total_results || 0);
      } else {
        setSearchError(res.data.error || 'Search failed.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError(err.response?.data?.error || 'Semantic search failed. Ensure the knowledge base is indexed.');
    } finally {
      setSearching(false);
    }
  };

  // Index Knowledge Base
  const handleIndex = async () => {
    setIndexing(true);
    setIndexError(null);
    setIndexResult(null);

    try {
      const res = await api.post('/rag/index', {
        project_id: user.project_id,
      });

      if (res.data.success) {
        setIndexResult(res.data.data.stats);
        fetchStats(); // Refresh stats after indexing
      } else {
        setIndexError(res.data.error || 'Indexing failed.');
      }
    } catch (err) {
      console.error('Index error:', err);
      setIndexError(err.response?.data?.error || 'Failed to index knowledge base.');
    } finally {
      setIndexing(false);
    }
  };

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('kb_search_history');
  };

  // Use a history query
  const useHistoryQuery = (historyQuery) => {
    setQuery(historyQuery);
  };

  // Similarity score color
  const getScoreColor = (score) => {
    if (score >= 0.8) return 'var(--color-success)';
    if (score >= 0.6) return 'var(--color-info)';
    if (score >= 0.4) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  // Sentiment emoji
  const getSentimentEmoji = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '❓';
    }
  };

  return (
    <div className="kb-container page-layout">
      {/* Header */}
      <div className="kb-header">
        <div className="header-meta">
          <h1>🧠 Knowledge Base</h1>
          <p className="project-token">
            Semantic search across all processed feedback, feature requests, and prioritized features
          </p>
        </div>
        <button
          onClick={handleIndex}
          className="action-btn kb-index-btn"
          disabled={indexing}
        >
          {indexing ? (
            <><span className="spinner-mini"></span> Indexing...</>
          ) : (
            '📥 Index Knowledge Base'
          )}
        </button>
      </div>

      {/* Index Result Alert */}
      {indexResult && (
        <div className="alert-message success-alert">
          <strong>Indexing Complete: </strong>
          {indexResult.total_indexed} documents indexed
          ({indexResult.total_skipped} skipped, {indexResult.total_errors} errors)
          using {indexResult.embedding_model}
        </div>
      )}
      {indexError && (
        <div className="alert-message error-alert">
          <strong>Indexing Error: </strong>{indexError}
        </div>
      )}

      {/* Stats Bar */}
      <div className="kb-stats-grid">
        <div className="kb-stat-card glass-panel">
          <span className="kb-stat-icon">📄</span>
          <div className="kb-stat-data">
            <span className="kb-stat-value">
              {statsLoading ? '...' : (stats?.total_indexed_documents ?? 0)}
            </span>
            <span className="kb-stat-label">Indexed Documents</span>
          </div>
        </div>
        <div className="kb-stat-card glass-panel">
          <span className="kb-stat-icon">🤖</span>
          <div className="kb-stat-data">
            <span className="kb-stat-value-small">
              {statsLoading ? '...' : (stats?.embedding_model ?? 'N/A')}
            </span>
            <span className="kb-stat-label">Embedding Model</span>
          </div>
        </div>
        <div className="kb-stat-card glass-panel">
          <span className="kb-stat-icon">🗄️</span>
          <div className="kb-stat-data">
            <span className="kb-stat-value-small">
              {statsLoading ? '...' : (stats?.vector_database ?? 'N/A')}
            </span>
            <span className="kb-stat-label">Vector Database</span>
          </div>
        </div>
        <div className="kb-stat-card glass-panel">
          <span className="kb-stat-icon">🔢</span>
          <div className="kb-stat-data">
            <span className="kb-stat-value">
              {statsLoading ? '...' : (stats?.embedding_dimension ?? 0)}
            </span>
            <span className="kb-stat-label">Embedding Dimension</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="kb-main-layout">
        {/* Left: Search + Results */}
        <div className="kb-search-panel">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="kb-search-form glass-panel">
            <div className="kb-search-input-wrapper">
              <span className="kb-search-icon">🔍</span>
              <input
                id="kb-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything... e.g. 'What are the most common login issues?'"
                className="kb-search-input"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="action-btn kb-search-btn"
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <><span className="spinner-mini"></span> Searching...</>
              ) : (
                '🔎 Semantic Search'
              )}
            </button>
          </form>

          {/* Search Error */}
          {searchError && (
            <div className="alert-message error-alert">
              <strong>Search Error: </strong>{searchError}
            </div>
          )}

          {/* Loading Indicator */}
          {searching && (
            <div className="kb-loading-container">
              <div className="spinner"></div>
              <p>Searching knowledge base with semantic similarity...</p>
            </div>
          )}

          {/* Search Meta */}
          {searchMeta && !searching && (
            <div className="kb-search-meta">
              <span>Found <strong>{searchMeta.total}</strong> results</span>
              <span className="kb-meta-separator">•</span>
              <span>Model: <strong>{searchMeta.model}</strong></span>
            </div>
          )}

          {/* Search Results */}
          {!searching && searchResults.length > 0 && (
            <div className="kb-results-list">
              {searchResults.map((result, idx) => (
                <div key={result.processed_id || idx} className="kb-result-card glass-panel">
                  {/* Score bar */}
                  <div className="kb-score-section">
                    <div className="kb-score-bar-container">
                      <div
                        className="kb-score-bar-fill"
                        style={{
                          width: `${Math.round(result.similarity_score * 100)}%`,
                          backgroundColor: getScoreColor(result.similarity_score),
                        }}
                      />
                    </div>
                    <span
                      className="kb-score-value"
                      style={{ color: getScoreColor(result.similarity_score) }}
                    >
                      {(result.similarity_score * 100).toFixed(1)}% match
                    </span>
                  </div>

                  {/* Content */}
                  <div className="kb-result-content">
                    <h3 className="kb-result-subject">
                      {result.feature_name || result.subject || 'Feedback Entry'}
                    </h3>
                    <p className="kb-result-preview">
                      {result.document_preview
                        ? result.document_preview.substring(0, 300) + (result.document_preview.length > 300 ? '...' : '')
                        : 'No preview available'}
                    </p>
                  </div>

                  {/* Metadata Tags */}
                  <div className="kb-result-meta">
                    <span className={`badge category-${result.category?.toLowerCase().replace(' ', '-')}`}>
                      {result.category}
                    </span>
                    <span className={`badge priority-${result.priority?.toLowerCase()}`}>
                      {result.priority}
                    </span>
                    <span className="kb-sentiment-tag">
                      {getSentimentEmoji(result.sentiment)} {result.sentiment}
                    </span>
                    <span className="kb-source-tag">
                      📦 {result.source === 'csv_upload' ? 'CSV Upload' : 'Form Submission'}
                    </span>
                    {result.weight > 1 && (
                      <span className="kb-weight-tag">⚖️ Weight: {result.weight}</span>
                    )}
                    {result.priority_class && (
                      <span className={`badge priority-${result.priority_class?.toLowerCase()}`}>
                        🎯 {result.priority_class}
                      </span>
                    )}
                    {result.moscow_category && (
                      <span className={`moscow-badge moscow-${result.moscow_category?.toLowerCase().replace(/\s+/g, '-').replace("'", '')}`}>
                        {result.moscow_category}
                      </span>
                    )}
                    {result.roi_score > 0 && (
                      <span className="kb-roi-tag">💰 ROI: {result.roi_score.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!searching && searchMeta && searchResults.length === 0 && (
            <div className="kb-empty-state glass-panel">
              <span className="kb-empty-icon">🔍</span>
              <h3>No Results Found</h3>
              <p>Try a different query or index the knowledge base first.</p>
            </div>
          )}

          {/* Initial State */}
          {!searching && !searchMeta && searchResults.length === 0 && !searchError && (
            <div className="kb-initial-state glass-panel">
              <span className="kb-initial-icon">🧠</span>
              <h3>Semantic Knowledge Search</h3>
              <p>
                Enter a natural language query to find relevant feedback, bug reports,
                feature requests, and prioritized features using AI-powered semantic search.
              </p>
              <div className="kb-example-queries">
                <p className="kb-example-label">Try these example queries:</p>
                {[
                  'What are the most common performance issues?',
                  'Show me critical bugs reported by customers',
                  'Feature requests related to user authentication',
                  'Customer complaints about slow loading times',
                ].map((example, i) => (
                  <button
                    key={i}
                    className="kb-example-btn"
                    onClick={() => { setQuery(example); }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Search History Sidebar */}
        <div className="kb-sidebar">
          <div className="kb-history-panel glass-panel">
            <div className="kb-history-header">
              <h3>🕐 Search History</h3>
              {searchHistory.length > 0 && (
                <button onClick={clearHistory} className="kb-history-clear-btn">
                  Clear
                </button>
              )}
            </div>

            {searchHistory.length === 0 ? (
              <div className="kb-history-empty">
                <p>No search history yet.</p>
              </div>
            ) : (
              <div className="kb-history-list">
                {searchHistory.map((entry, idx) => (
                  <button
                    key={idx}
                    className="kb-history-item"
                    onClick={() => useHistoryQuery(entry.query)}
                    title={`Results: ${entry.resultCount} • ${new Date(entry.timestamp).toLocaleString()}`}
                  >
                    <span className="kb-history-query">{entry.query}</span>
                    <div className="kb-history-meta">
                      <span>{entry.resultCount} results</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
