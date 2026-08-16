import React, { useState, useEffect, useCallback } from 'react';
import FeedbackForm from '../components/FeedbackForm';
import api from '../services/api';

const FeedbackFormPage = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/ingest/my-feedback');
      if (response.data.success) {
        setFeedbacks(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load your previous feedback submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyFeedback();
  }, []);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'processed':
        return 'status-badge-processed';
      case 'duplicate':
        return 'status-badge-duplicate';
      case 'failed':
        return 'status-badge-failed';
      case 'processing':
        return 'status-badge-processing';
      case 'pending':
      default:
        return 'status-badge-pending';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'processed': return 'Processed';
      case 'duplicate': return 'Duplicate Match';
      case 'failed': return 'Failed';
      case 'processing': return 'Processing...';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  return (
    <div className="feedback-form-page page-layout">
      <div className="page-header">
        <h1>Customer Feedback Portal</h1>
        <p>Record a new product feedback request, bug description, or improvement proposal.</p>
      </div>

      <div className="customer-portal-grid">
        {/* Left Side: Submit Feedback Form */}
        <div className="portal-form-column">
          <FeedbackForm onSuccess={fetchMyFeedback} />
        </div>

        {/* Right Side: Submitted Feedback List */}
        <div className="portal-history-column glass-panel">
          <div className="panel-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="panel-title">Your Submitted Feedback</h2>
              <p className="panel-subtitle">Track the status of your reported items</p>
            </div>
            <button
              className="action-btn refresh-btn"
              onClick={fetchMyFeedback}
              disabled={loading}
              title="Refresh to see latest processing status"
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? '⏳ Refreshing...' : '🔄 Refresh Status'}
            </button>
          </div>

          {loading && feedbacks.length === 0 ? (
            <div className="history-loader">
              <div className="spinner"></div>
              <p>Loading your feedback history...</p>
            </div>
          ) : error ? (
            <div className="alert-message error-alert">
              {error}
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="empty-history-state">
              <span className="empty-icon">📁</span>
              <p>You haven't submitted any feedback yet. Use the form on the left to get started!</p>
            </div>
          ) : (
            <div className="history-list">
              {feedbacks.map((item) => (
                <div key={item.feedback_id} className="history-item">
                  <div className="history-item-header">
                    <h4>{item.subject}</h4>
                    <span className={`status-badge ${getStatusBadgeClass(item.processing_status)}`}>
                      {getStatusLabel(item.processing_status)}
                    </span>
                  </div>
                  
                  <p className="history-item-description">{item.description}</p>
                  
                  <div className="history-item-meta">
                    <span className={`badge category-${(item.category || 'General').toLowerCase().replace(' ', '-')}`}>
                      {item.category || 'General'}
                    </span>
                    <span className={`badge priority-${(item.priority || 'Medium').toLowerCase()}`}>
                      {item.priority || 'Medium'}
                    </span>
                    {item.product_name && (
                      <span className="meta-info-chip">
                        📦 {item.product_name} {item.product_version ? `v${item.product_version}` : ''}
                      </span>
                    )}
                    <span className="meta-time">
                      🗓️ {item.upload_timestamp ? new Date(item.upload_timestamp).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackFormPage;
