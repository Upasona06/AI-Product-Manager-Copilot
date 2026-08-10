import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

const ClassificationPage = () => {
  const { user } = useContext(AuthContext);

  // Loading and action state
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Main data states
  const [feedbacks, setFeedbacks] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    bug: 0,
    feature: 0,
    complaint: 0,
    improvement: 0
  });

  // UI state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [runHovered, setRunHovered] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [priority, setPriority] = useState("");

  // Sorting state
  const [sortBy, setSortBy] = useState("confidence");
  const [sortOrder, setSortOrder] = useState("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Helper matching functions for robust category categorization
  const isBug = (cat) => {
    const c = cat?.toLowerCase();
    return c === "bug" || c === "bug report" || c === "bug reports" || c === "bug_report";
  };
  const isFeature = (cat) => {
    const c = cat?.toLowerCase();
    return c === "feature" || c === "feature request" || c === "feature requests" || c === "feature_request";
  };
  const isComplaint = (cat) => {
    const c = cat?.toLowerCase();
    return c === "complaint" || c === "complaints";
  };
  const isImprovement = (cat) => {
    const c = cat?.toLowerCase();
    return c === "improvement" || c === "improvements";
  };

  const getCategoryLabel = (cat) => {
    if (isBug(cat)) return "Bug Report";
    if (isFeature(cat)) return "Feature Request";
    if (isComplaint(cat)) return "Complaint";
    if (isImprovement(cat)) return "Improvement";
    return cat || "N/A";
  };

  const fetchClassificationData = async () => {
    if (!user?.project_id) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(
        `/api/classification/results?project_id=${user.project_id}`
      );

      if (response.data.success) {
        const rawData = Array.isArray(response.data.data)
          ? response.data.data
          : (response.data.data?.results || []);

        const mappedData = rawData.map(i => ({
          ...i,
          category: i.category || i.ai_category || "",
          confidence: i.confidence !== undefined ? i.confidence : (i.ai_confidence_score !== undefined ? i.ai_confidence_score : 0),
          sentiment: i.sentiment || i.ai_sentiment || "Neutral",
          feedback_text: i.feedback_text || i.clean_text || i.original_description || i.feedback || ""
        }));

        // Exclude general and other categories to restrict output strictly to the 4 categories
        const filtered = mappedData.filter(i =>
          isBug(i.category) ||
          isFeature(i.category) ||
          isComplaint(i.category) ||
          isImprovement(i.category)
        );

        setFeedbacks(filtered);

        setMetrics({
          total: filtered.length,
          bug: filtered.filter(i => isBug(i.category)).length,
          feature: filtered.filter(i => isFeature(i.category)).length,
          complaint: filtered.filter(i => isComplaint(i.category)).length,
          improvement: filtered.filter(i => isImprovement(i.category)).length
        });
      }
    } catch (err) {
      console.error("Full fetch classification error response:", err);
      if (err.response) {
        setError(err.response.data?.error || err.response.data?.message || "Server Error: Failed to fetch classification results.");
      } else if (err.request) {
        setError("Network Error: Unable to fetch classification results. Please check if backend service is running.");
      } else {
        setError(err.message || "Server Error: Failed to fetch classification results.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassificationData();
  }, [user]);

  const handleRunClassification = async () => {
    if (!user?.project_id) return;
    setRunning(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(
        "/api/classification/run",
        { project_id: user.project_id }
      );

      if (response.data.success) {
        setSuccess(response.data.message || "AI Classification completed successfully");
        fetchClassificationData();
      } else {
        setError(response.data.error || "Classification failed");
      }
    } catch (err) {
      console.error("Full run classification error response:", err);
      if (err.response) {
        setError(err.response.data?.error || err.response.data?.message || "Classification failed");
      } else if (err.request) {
        setError("Network Error: Unable to connect to the AI service. Please verify the server is running and accessible.");
      } else {
        setError(err.message || "Unable to connect AI service");
      }
    } finally {
      setRunning(false);
    }
  };

  // Sorting handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  // Filter local logic
  const filteredData = feedbacks.filter(item => {
    const searchMatch = (item.feedback_text || item.feedback || "")
      .toLowerCase()
      .includes(search.toLowerCase());

    const categoryMatch =
      category === "" ||
      (category === "Bug Reports" && isBug(item.category)) ||
      (category === "Feature Requests" && isFeature(item.category)) ||
      (category === "Complaints" && isComplaint(item.category)) ||
      (category === "Improvements" && isImprovement(item.category));

    const sentimentMatch =
      sentiment === "" ||
      (item.sentiment || "").toLowerCase() === sentiment.toLowerCase();

    const priorityMatch =
      priority === "" ||
      (item.priority || "").toLowerCase() === priority.toLowerCase();

    return searchMatch && categoryMatch && sentimentMatch && priorityMatch;
  });

  // Sort local logic
  const sortedData = [...filteredData].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === "confidence") {
      valA = parseFloat(a.confidence) || 0;
      valB = parseFloat(b.confidence) || 0;
    } else {
      valA = (valA || "").toString().toLowerCase();
      valB = (valB || "").toString().toLowerCase();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const paginatedData = sortedData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  // Auto-adjust page when totalPages shrinks due to filters
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  // Inline Style Declarations
  const containerStyle = {
    padding: "2.5rem 1.5rem",
    maxWidth: "1400px",
    width: "100%",
    margin: "0 auto",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    minHeight: "100vh",
    color: "#f3f4f6"
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2.5rem",
    gap: "1rem",
    flexWrap: "wrap"
  };

  const headerMetaStyle = {
    display: "flex",
    flexDirection: "column"
  };

  const titleStyle = {
    fontSize: "2.2rem",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    marginBottom: "0.5rem",
    background: "linear-gradient(to right, #ffffff, #c084fc)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0
  };

  const subtitleStyle = {
    color: "#9ca3af",
    fontSize: "1.05rem",
    margin: 0
  };

  const actionBtnStyle = (disabled) => ({
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    padding: "0.8rem 1.5rem",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    opacity: disabled ? 0.6 : 1,
    boxShadow: disabled ? "none" : "0 0 15px rgba(124, 58, 237, 0.3)"
  });

  const alertStyle = (type) => {
    const isSuccess = type === "success";
    return {
      padding: "1rem 1.25rem",
      borderRadius: "6px",
      fontSize: "0.95rem",
      marginBottom: "1.5rem",
      lineHeight: 1.4,
      borderLeft: "4px solid " + (isSuccess ? "#10b981" : "#ef4444"),
      background: isSuccess ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
      color: isSuccess ? "#a7f3d0" : "#fca5a5"
    };
  };

  const metricsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1.5rem",
    marginBottom: "2.5rem"
  };

  const glassPanelStyle = {
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "2rem",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  };

  const metricCardStyle = {
    ...glassPanelStyle,
    display: "flex",
    alignItems: "center",
    gap: "1.25rem",
    padding: "1.5rem"
  };

  const metricIconStyle = {
    fontSize: "2.2rem",
    background: "rgba(255, 255, 255, 0.05)",
    width: "60px",
    height: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.08)"
  };

  const metricDataStyle = {
    display: "flex",
    flexDirection: "column"
  };

  const metricValueStyle = {
    fontSize: "1.8rem",
    fontWeight: 700,
    lineHeight: "1.2",
    color: "#f3f4f6"
  };

  const metricLabelStyle = {
    fontSize: "0.85rem",
    color: "#9ca3af",
    fontWeight: "500"
  };

  const filterToolbarStyle = {
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "1.25rem",
    marginBottom: "2rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    alignItems: "center"
  };

  const filtersContainerStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    alignItems: "center",
    width: "100%"
  };

  const inputStyle = {
    background: "rgba(10, 10, 18, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "6px",
    color: "#f3f4f6",
    padding: "0.75rem 1rem",
    fontSize: "0.95rem",
    outline: "none",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    flex: "1 1 200px"
  };

  const selectStyle = {
    background: "rgba(10, 10, 18, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "6px",
    color: "#f3f4f6",
    padding: "0.75rem 1rem",
    fontSize: "0.95rem",
    outline: "none",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    flex: "1 1 180px",
    cursor: "pointer"
  };

  const tableResponsiveStyle = {
    width: "100%",
    overflowX: "auto",
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "1.5rem"
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "0.92rem"
  };

  const thStyle = {
    padding: "1rem 1.25rem",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    fontWeight: "600",
    color: "#9ca3af",
    background: "rgba(255, 255, 255, 0.02)",
    textTransform: "uppercase",
    fontSize: "0.8rem",
    letterSpacing: "0.05em"
  };

  const tdStyle = {
    padding: "1rem 1.25rem",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#f3f4f6",
    verticalAlign: "middle"
  };

  const badgeStyle = {
    display: "inline-block",
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    fontSize: "0.78rem",
    fontWeight: "600",
    textTransform: "uppercase"
  };

  const getCategoryBadgeStyle = (cat) => {
    if (isBug(cat)) return { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" };
    if (isFeature(cat)) return { background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" };
    if (isComplaint(cat)) return { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" };
    if (isImprovement(cat)) return { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" };
    return { background: "rgba(255, 255, 255, 0.08)", color: "#9ca3af" };
  };

  const getPriorityBadgeStyle = (priority) => {
    const p = priority?.toLowerCase();
    if (p === "high" || p === "critical") return { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" };
    if (p === "medium") return { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" };
    if (p === "low") return { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" };
    return { background: "rgba(255, 255, 255, 0.08)", color: "#9ca3af" };
  };

  const getSentimentBadgeStyle = (sentiment) => {
    const s = sentiment?.toLowerCase();
    if (s === "positive") return { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" };
    if (s === "negative") return { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" };
    if (s === "neutral") return { background: "rgba(255, 255, 255, 0.08)", color: "#9ca3af" };
    if (s === "mixed") return { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" };
    return { background: "rgba(255, 255, 255, 0.08)", color: "#9ca3af" };
  };

  const formatConfidence = (conf) => {
    if (conf === undefined || conf === null) return "0%";
    const num = parseFloat(conf);
    if (isNaN(num)) return "0%";
    if (num <= 1.0) return `${Math.round(num * 100)}%`;
    return `${Math.round(num)}%`;
  };

  const paginationBarStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "1.5rem"
  };

  const paginationBtnStyle = (disabled) => ({
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#f3f4f6",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 500,
    opacity: disabled ? 0.4 : 1,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  });

  const paginationInfoStyle = {
    fontSize: "0.88rem",
    color: "#9ca3af"
  };

  const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(10, 10, 18, 0.8)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  };

  const modalContentStyle = {
    background: "#0f0f1a",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "2rem",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
    color: "#f3f4f6"
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerMetaStyle}>
          <h1 style={titleStyle}>AI Feedback Classification</h1>
          <p style={subtitleStyle}>
            Automatically classify customer feedback using AI into Bug Reports, Feature Requests, Complaints and Improvements.
          </p>
        </div>

        <button
          onClick={handleRunClassification}
          disabled={running}
          onMouseEnter={() => setRunHovered(true)}
          onMouseLeave={() => setRunHovered(false)}
          style={{
            ...actionBtnStyle(running),
            background: runHovered && !running ? "#9333ea" : "#7c3aed",
            boxShadow: runHovered && !running ? "0 0 25px rgba(124, 58, 237, 0.5)" : "0 0 15px rgba(124, 58, 237, 0.3)"
          }}
        >
          {running ? "Running..." : "🤖 Run AI Classification"}
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div style={alertStyle("success")}>
          ✅ {success}
        </div>
      )}

      {error && (
        <div style={alertStyle("error")}>
          ❌ {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div style={metricsGridStyle}>
        {[
          { icon: "📂", label: "Total Feedback", value: metrics.total, color: "#c084fc" },
          { icon: "🐞", label: "Bug Reports", value: metrics.bug, color: "#f87171" },
          { icon: "💡", label: "Feature Requests", value: metrics.feature, color: "#60a5fa" },
          { icon: "⚠️", label: "Complaints", value: metrics.complaint, color: "#fbbf24" },
          { icon: "🚀", label: "Improvements", value: metrics.improvement, color: "#34d399" },
        ].map((m, index) => (
          <div key={index} style={metricCardStyle}>
            <span style={{ ...metricIconStyle, color: m.color }}>{m.icon}</span>
            <div style={metricDataStyle}>
              <span style={metricValueStyle}>{m.value}</span>
              <span style={metricLabelStyle}>{m.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div style={filterToolbarStyle}>
        <div style={filtersContainerStyle}>
          <input
            placeholder="Search feedback..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={inputStyle}
          />

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="">All Categories</option>
            <option value="Bug Reports">Bug Reports</option>
            <option value="Feature Requests">Feature Requests</option>
            <option value="Complaints">Complaints</option>
            <option value="Improvements">Improvements</option>
          </select>

          <select
            value={sentiment}
            onChange={(e) => {
              setSentiment(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
            <option value="Mixed">Mixed</option>
          </select>

          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ ...glassPanelStyle, textAlign: "center", padding: "3rem" }}>
          <h3 style={{ margin: 0, color: "#9ca3af" }}>Loading AI Classification...</h3>
        </div>
      ) : paginatedData.length === 0 ? (
        <div style={{ ...glassPanelStyle, textAlign: "center", padding: "3rem" }}>
          <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>🤖 No classified feedback found</h2>
          <p style={{ color: "#9ca3af", margin: 0 }}>
            Upload customer feedback and run AI Classification.
          </p>
        </div>
      ) : (
        <div style={tableResponsiveStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th
                  style={{ ...thStyle, cursor: "pointer" }}
                  onClick={() => handleSort("feedback_text")}
                >
                  Feedback {renderSortIndicator("feedback_text")}
                </th>
                <th
                  style={{ ...thStyle, cursor: "pointer" }}
                  onClick={() => handleSort("category")}
                >
                  Category {renderSortIndicator("category")}
                </th>
                <th
                  style={{ ...thStyle, cursor: "pointer" }}
                  onClick={() => handleSort("sentiment")}
                >
                  Sentiment {renderSortIndicator("sentiment")}
                </th>
                <th
                  style={{ ...thStyle, cursor: "pointer" }}
                  onClick={() => handleSort("priority")}
                >
                  Priority {renderSortIndicator("priority")}
                </th>
                <th
                  style={{ ...thStyle, cursor: "pointer" }}
                  onClick={() => handleSort("confidence")}
                >
                  Confidence {renderSortIndicator("confidence")}
                </th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, index) => (
                <tr
                  key={index}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === index ? "rgba(255, 255, 255, 0.02)" : "transparent",
                    transition: "background 0.2s ease"
                  }}
                >
                  <td style={{ ...tdStyle, maxWidth: "400px", wordBreak: "break-word" }}>
                    {item.feedback_text || item.feedback}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, ...getCategoryBadgeStyle(item.category) }}>
                      {getCategoryLabel(item.category)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, ...getSentimentBadgeStyle(item.sentiment) }}>
                      {item.sentiment || "Neutral"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, ...getPriorityBadgeStyle(item.priority) }}>
                      {item.priority || "Medium"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: "600", color: "#c084fc" }}>
                    {formatConfidence(item.confidence)}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setSelectedFeedback(item)}
                      style={{
                        background: "#7c3aed",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => { e.target.style.background = "#9333ea"; }}
                      onMouseLeave={(e) => { e.target.style.background = "#7c3aed"; }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={paginationBarStyle}>
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                style={paginationBtnStyle(page === 1)}
              >
                Previous
              </button>
              <span style={paginationInfoStyle}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                style={paginationBtnStyle(page === totalPages)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* View Modal */}
      {selectedFeedback && (
        <div style={modalOverlayStyle} onClick={() => setSelectedFeedback(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: "1.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.75rem", fontSize: "1.3rem" }}>Feedback Details</h2>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Feedback Text</label>
              <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "6px", padding: "1rem", lineHeight: "1.5", fontSize: "0.95rem", maxHeight: "200px", overflowY: "auto" }}>
                {selectedFeedback.feedback_text || selectedFeedback.feedback}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Category</label>
                <span style={{ ...badgeStyle, ...getCategoryBadgeStyle(selectedFeedback.category) }}>
                  {getCategoryLabel(selectedFeedback.category)}
                </span>
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Confidence</label>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#c084fc" }}>
                  {formatConfidence(selectedFeedback.confidence)}
                </span>
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Sentiment</label>
                <span style={{ ...badgeStyle, ...getSentimentBadgeStyle(selectedFeedback.sentiment) }}>
                  {selectedFeedback.sentiment || "Neutral"}
                </span>
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Priority</label>
                <span style={{ ...badgeStyle, ...getPriorityBadgeStyle(selectedFeedback.priority) }}>
                  {selectedFeedback.priority || "Medium"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSelectedFeedback(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#f3f4f6",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => { e.target.style.background = "rgba(255, 255, 255, 0.1)"; }}
                onMouseLeave={(e) => { e.target.style.background = "rgba(255, 255, 255, 0.05)"; }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassificationPage;
