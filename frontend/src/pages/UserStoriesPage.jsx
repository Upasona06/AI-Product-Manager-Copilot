import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const UserStoriesPage = () => {
  const { user } = useContext(AuthContext);

  // Backlog features list
  const [features, setFeatures] = useState([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState('');

  // Form inputs
  const [featureName, setFeatureName] = useState('');
  const [description, setDescription] = useState('');

  // Saved user stories list
  const [savedStories, setSavedStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);

  // UI status
  const [loadingBacklog, setLoadingBacklog] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch prioritized features for select dropdown
  useEffect(() => {
    const fetchBacklog = async () => {
      try {
        setLoadingBacklog(true);
        const res = await api.get(`/api/prioritize/results?project_id=${user.project_id}&page_size=50`);
        if (res.data.success) {
          setFeatures(res.data.data.results || []);
        }
      } catch (err) {
        console.error("Failed to load prioritization backlog for User Stories:", err);
      } finally {
        setLoadingBacklog(false);
      }
    };

    if (user && user.project_id) {
      fetchBacklog();
    }
  }, [user]);

  // Fetch saved user stories list
  const fetchSavedStories = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get(`/api/user-story/list?project_id=${user.project_id}`);
      if (res.data.success) {
        setSavedStories(res.data.stories || []);
      }
    } catch (err) {
      console.error("Failed to load saved user stories:", err);
      setError("Could not load previously saved user stories.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user && user.project_id) {
      fetchSavedStories();
    }
  }, [user]);

  // Handle dropdown select
  const handleFeatureSelect = (e) => {
    const featId = e.target.value;
    setSelectedFeatureId(featId);

    if (featId === 'custom' || featId === '') {
      setFeatureName('');
      setDescription('');
    } else {
      const selected = features.find(f => f.prioritization_id === featId);
      if (selected) {
        setFeatureName(selected.feature_name);
        setDescription(selected.description || '');
      }
    }
  };

  // Generate User Stories
  const handleGenerateStories = async (e) => {
    e.preventDefault();
    if (!featureName.trim()) {
      setError("Please specify a feature name.");
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await api.post('/api/user-story/generate', {
        project_id: user.project_id,
        prioritization_id: selectedFeatureId && selectedFeatureId !== 'custom' ? selectedFeatureId : null,
        feature_name: featureName,
        description: description
      });

      if (response.data.success) {
        const newStory = response.data.story;
        setActiveStory(newStory);
        setSuccessMsg("User Stories generated and saved successfully!");
        fetchSavedStories(); // Refresh list
      } else {
        setError(response.data.error || "Failed to generate User Stories.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      const backendError = resData
        ? `${resData.error || ""}${resData.details ? " Details: " + resData.details : ""}`
        : "Gemini AI generation service failed. Check if API key is set.";
      setError(backendError);
    } finally {
      setGenerating(false);
    }
  };

  // Delete User Story
  const handleDeleteStory = async (storyId, e) => {
    e.stopPropagation(); // Prevent selecting
    if (!window.confirm("Are you sure you want to delete these user stories?")) return;

    try {
      const res = await api.delete(`/api/user-story/${storyId}`);
      if (res.data.success) {
        setSuccessMsg("User story deleted successfully.");
        if (activeStory && activeStory.story_id === storyId) {
          setActiveStory(null);
        }
        fetchSavedStories(); // Refresh list
      }
    } catch (err) {
      console.error("Failed to delete user story:", err);
      setError("Failed to delete user story from database.");
    }
  };

  // Copy to Clipboard
  const handleCopyToClipboard = () => {
    if (!activeStory) return;
    navigator.clipboard.writeText(activeStory.story_content);
    setSuccessMsg("Copied to clipboard!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Download Markdown File
  const handleDownload = () => {
    if (!activeStory) return;
    const element = document.createElement("a");
    const file = new Blob([activeStory.story_content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeStory.feature_name.toLowerCase().replace(/\s+/g, '-')}-user-stories.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="user-stories-container page-layout">
      <div className="dashboard-header">
        <div className="header-meta">
          <h1>📝 AI User Story Generator</h1>
          <p>Generate detailed Agile User Stories, BDD Acceptance Criteria, and Definitions of Done using Gemini AI.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
        {/* Left Column: Form Controls & Saved Stories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Generator Controls */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3>Configure Feature Context</h3>
            <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '1rem 0' }} />

            <form onSubmit={handleGenerateStories}>
              {/* Feature Selector */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Select Feature from Prioritized Backlog
                </label>
                <select
                  value={selectedFeatureId}
                  onChange={handleFeatureSelect}
                  disabled={loadingBacklog}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {loadingBacklog ? (
                    <option>Loading prioritized backlog...</option>
                  ) : (
                    <>
                      <option value="">-- Choose a feature --</option>
                      {features.map((f) => (
                        <option key={f.prioritization_id} value={f.prioritization_id}>
                          {f.feature_name} ({f.priority_class})
                        </option>
                      ))}
                      <option value="custom">✍️ Custom Feature (Input manually)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Feature Name */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Feature Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Password Reset Flow"
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px'
                  }}
                />
              </div>

              {/* Description / Scope */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Feature Description / PRD Context
                </label>
                <textarea
                  placeholder="Outline what this feature does, including any specific user requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button
                type="submit"
                className="action-btn"
                disabled={generating}
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {generating ? "✨ Generating Stories..." : "✨ Generate User Stories"}
              </button>
            </form>

            {error && (
              <div className="alert-message error-alert" style={{ marginTop: '1.25rem' }}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          {/* History Sidebar */}
          <div className="portal-history-column glass-panel" style={{ padding: '1.5rem', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Saved User Stories ({savedStories.length})</h3>
            <div className="history-list" style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div className="history-loader" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                  <p>Loading history...</p>
                </div>
              ) : savedStories.length === 0 ? (
                <div className="empty-history-state" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <p>No saved stories found.</p>
                </div>
              ) : (
                savedStories.map((story) => (
                  <div
                    key={story.story_id}
                    className={`history-item ${activeStory && activeStory.story_id === story.story_id ? 'active-history' : ''}`}
                    onClick={() => setActiveStory(story)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      background: activeStory && activeStory.story_id === story.story_id ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '1rem' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{story.feature_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {new Date(story.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteStory(story.story_id, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                      }}
                      title="Delete User Story"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Output Viewer */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Active Specifications View</h3>
            {activeStory && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleCopyToClipboard} className="action-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  📋 Copy
                </button>
                <button onClick={handleDownload} className="action-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#2563eb' }}>
                  💾 Download
                </button>
              </div>
            )}
          </div>
          <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '0 0 1rem 0' }} />

          {successMsg && (
            <div className="alert-message info-alert" style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
              <strong>Notice:</strong> {successMsg}
            </div>
          )}

          {activeStory ? (
            <MarkdownRenderer content={activeStory.story_content} />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--text-muted)',
              border: '2px dashed rgba(255,255,255,0.1)',
              borderRadius: '6px',
              minHeight: '400px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📝</span>
              <p>Your AI-generated Agile User Stories, BDD Acceptance Criteria, and DoD will appear here.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Select a feature from your backlog or type custom details on the left, then click generate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStoriesPage;
