import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const SettingsPage = () => {
  const { user } = useContext(AuthContext);
  const isCustomer = user?.role === 'customer';

  // Current logged in user profile
  const [profileUser, setProfileUser] = useState(null);

  // Workspace metadata state
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Workspace Name & Description (persisted locally per project)
  const [workspaceName, setWorkspaceName] = useState(() => {
    return localStorage.getItem('workspace_name') || 'SaaS Core Platform';
  });
  const [workspaceDesc, setWorkspaceDesc] = useState(() => {
    return localStorage.getItem('workspace_desc') || 'Enterprise customer feedback intelligence and backlog automation workspace.';
  });
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);

  // Member directory list view state (collapsed by default)
  const [showMembers, setShowMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'default';
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI status
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // Fetch current user profile from /api/auth/me
  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/api/auth/me');
      if (response.data.success) {
        setProfileUser(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  // Fetch workspace details from backend
  const fetchWorkspaceInfo = async () => {
    setLoadingWorkspace(true);
    try {
      const response = await api.get('/api/auth/workspace');
      if (response.data.success) {
        setWorkspaceData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load workspace info:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchWorkspaceInfo();
  }, []);

  // Copy Project ID to clipboard
  const handleCopyProjectId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  // Save workspace details
  const handleSaveWorkspace = (e) => {
    e.preventDefault();
    localStorage.setItem('workspace_name', workspaceName);
    localStorage.setItem('workspace_desc', workspaceDesc);
    setIsEditingWorkspace(false);
    setWorkspaceSaved(true);
    setTimeout(() => setWorkspaceSaved(false), 3000);
  };

  // Apply theme change
  const handleThemeChange = (selectedTheme) => {
    setTheme(selectedTheme);
    localStorage.setItem('app_theme', selectedTheme);
    document.documentElement.setAttribute('data-theme', selectedTheme);
  };

  // Change password submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    setSubmittingPassword(true);

    try {
      const response = await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });

      if (response.data.success) {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(response.data.error || "Failed to update password.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      setPasswordError(resData?.error || "Error updating password. Double check your current password.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const currentEmail = profileUser?.email || user?.email || 'N/A';
  const currentFullName = profileUser?.full_name || user?.full_name || (user?.role === 'product_manager' ? 'Product Manager' : 'Customer');
  const currentRole = profileUser?.role || user?.role || 'customer';
  const projectId = workspaceData?.project_id || profileUser?.project_id || user?.project_id || '550e8400-e29b-41d4-a716-446655440000';

  return (
    <div className="settings-page-container page-layout" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="dashboard-header">
        <div className="header-meta">
          <h1>⚙️ Settings & Account</h1>
          <p>Manage your personal profile, linked workspace, team permissions, and security preferences.</p>
        </div>
      </div>

      {/* SECTION 1: USER ACCOUNT & EMAIL IDENTITY CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem 2rem',
          marginTop: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          borderLeft: '4px solid var(--accent-primary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              flexShrink: 0
            }}
          >
            {currentFullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{currentFullName}</h2>
              <span
                style={{
                  padding: '0.2rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: currentRole === 'product_manager' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: currentRole === 'product_manager' ? '#c4b5fd' : '#7dd3fc',
                  border: currentRole === 'product_manager' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                {currentRole === 'product_manager' ? '💼 Product Manager' : '🙋 Customer'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>✉️ Email ID:</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {currentEmail}
              </strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 500
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
            Active Session
          </span>
        </div>
      </div>

      {/* SECTION 2: WORKSPACE & PROJECT MANAGEMENT CARD */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🏢</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{workspaceName}</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{workspaceDesc}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!isCustomer && (
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => setIsEditingWorkspace(!isEditingWorkspace)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isEditingWorkspace ? "Cancel" : "✏️ Edit Workspace"}
              </button>
            )}
            <button
              type="button"
              className="action-btn-secondary"
              onClick={() => {
                fetchUserProfile();
                fetchWorkspaceInfo();
              }}
              disabled={loadingWorkspace}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              {loadingWorkspace ? "Refreshing..." : "🔄 Refresh Data"}
            </button>
          </div>
        </div>

        {/* Edit Workspace Form */}
        {isEditingWorkspace && !isCustomer && (
          <form onSubmit={handleSaveWorkspace} style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. SaaS Core Platform"
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Workspace Description</label>
                <input
                  type="text"
                  value={workspaceDesc}
                  onChange={(e) => setWorkspaceDesc(e.target.value)}
                  placeholder="Brief description of this workspace/product..."
                />
              </div>
            </div>
            <button type="submit" className="action-btn" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
              💾 Save Workspace Details
            </button>
          </form>
        )}

        {workspaceSaved && (
          <div className="alert-message success-alert" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
            ✅ Workspace details updated successfully!
          </div>
        )}

        {/* Project ID Box with Copy Action */}
        <div
          style={{
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔑 Workspace Key / Project ID
              </span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.5rem', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                Multi-Tenant Identifier
              </span>
            </div>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: '1rem',
                color: '#fff',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                display: 'inline-block',
                wordBreak: 'break-all'
              }}
            >
              {projectId}
            </code>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Share this Project ID with customers and team members so their feedback is automatically routed to this workspace.
            </p>
          </div>

          <button
            type="button"
            className="action-btn"
            onClick={() => handleCopyProjectId(projectId)}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: copiedId ? '#10b981' : undefined
            }}
          >
            {copiedId ? "✅ Copied to Clipboard!" : "📋 Copy Workspace ID"}
          </button>
        </div>

        {/* Workspace Active Metrics */}
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>
          📊 Workspace Activity & Team Breakdown
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>👥 Total Members</span>
            <strong style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>
              {loadingWorkspace ? '...' : (workspaceData?.total_members ?? 1)}
            </strong>
          </div>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>💼 Product Managers</span>
            <strong style={{ fontSize: '1.6rem', color: 'var(--accent-primary)' }}>
              {loadingWorkspace ? '...' : (workspaceData?.pm_count ?? 1)}
            </strong>
          </div>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>🙋 Active Customers</span>
            <strong style={{ fontSize: '1.6rem', color: '#0284c7' }}>
              {loadingWorkspace ? '...' : (workspaceData?.customer_count ?? 0)}
            </strong>
          </div>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>📥 Ingested Feedback</span>
            <strong style={{ fontSize: '1.6rem', color: '#10b981' }}>
              {loadingWorkspace ? '...' : (workspaceData?.total_feedback ?? 0)}
            </strong>
          </div>
        </div>

        {/* Workspace Members Directory (Collapsible Accordion) */}
        {workspaceData?.members && workspaceData.members.length > 0 && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '0.5rem 0'
              }}
              onClick={() => setShowMembers(!showMembers)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>👥</span> Registered Members in this Project
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {workspaceData.members.length} users
                  </span>
                </h4>
              </div>

              <button
                type="button"
                className="action-btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMembers(!showMembers);
                }}
              >
                {showMembers ? "▲ Hide Member List" : "▼ View Member List"}
              </button>
            </div>

            {/* Expanded Table & Filters */}
            {showMembers && (
              <div style={{ marginTop: '1rem', animation: 'fadeIn 0.2s ease-in-out' }}>
                {/* Search & Filter Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search member by name or email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      minWidth: '260px'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setMemberRoleFilter('all')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        border: '1px solid var(--glass-border)',
                        background: memberRoleFilter === 'all' ? 'var(--accent-primary)' : 'var(--glass-bg)',
                        color: memberRoleFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      All ({workspaceData.members.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberRoleFilter('customer')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        border: '1px solid var(--glass-border)',
                        background: memberRoleFilter === 'customer' ? 'rgba(56, 189, 248, 0.25)' : 'var(--glass-bg)',
                        color: memberRoleFilter === 'customer' ? '#38bdf8' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      🙋 Customers ({workspaceData.customer_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberRoleFilter('product_manager')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        border: '1px solid var(--glass-border)',
                        background: memberRoleFilter === 'product_manager' ? 'rgba(167, 139, 250, 0.25)' : 'var(--glass-bg)',
                        color: memberRoleFilter === 'product_manager' ? '#a78bfa' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      💼 PMs ({workspaceData.pm_count})
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Email</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceData.members
                        .filter((m) => {
                          if (memberRoleFilter !== 'all' && m.role !== memberRoleFilter) return false;
                          if (memberSearch.trim()) {
                            const q = memberSearch.toLowerCase();
                            return (
                              (m.full_name && m.full_name.toLowerCase().includes(q)) ||
                              (m.email && m.email.toLowerCase().includes(q))
                            );
                          }
                          return true;
                        })
                        .map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{m.full_name}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{m.email}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: m.role === 'product_manager' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                  color: m.role === 'product_manager' ? '#c4b5fd' : '#7dd3fc',
                                  border: m.role === 'product_manager' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)'
                                }}
                              >
                                {m.role === 'product_manager' ? '💼 Product Manager' : '🙋 Customer'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#34d399' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: APPEARANCE & SECURITY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* Theme Settings Card */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3>🎨 Appearance & Theme</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Choose a visual style for your PM Copilot dashboard.
          </p>
          <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '0 0 1.5rem 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Theme option 1: System default */}
            <div
              onClick={() => handleThemeChange('default')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderRadius: '8px',
                background: theme === 'default' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(0,0,0,0.15)',
                border: theme === 'default' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>💻 System Default</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sync layout automatically with device theme.</span>
              </div>
              {theme === 'default' && <span style={{ fontSize: '1.5rem' }}>✅</span>}
            </div>

            {/* Theme option 2: Dark Theme */}
            <div
              onClick={() => handleThemeChange('dark')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderRadius: '8px',
                background: theme === 'dark' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(0,0,0,0.15)',
                border: theme === 'dark' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>🌙 Dark Theme</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A refined, battery-saving dark interface.</span>
              </div>
              {theme === 'dark' && <span style={{ fontSize: '1.5rem' }}>✅</span>}
            </div>

            {/* Theme option 3: Light Theme */}
            <div
              onClick={() => handleThemeChange('light')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderRadius: '8px',
                background: theme === 'light' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(0,0,0,0.15)',
                border: theme === 'light' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>☀️ Light Theme</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A clean, high-contrast light interface.</span>
              </div>
              {theme === 'light' && <span style={{ fontSize: '1.5rem' }}>✅</span>}
            </div>
          </div>
        </div>

        {/* Security / Password Card */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>🔒 Security & Credentials</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Update your account password to ensure ongoing access security.
          </p>
          <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '0 0 1.5rem 0' }} />

          <form onSubmit={handleChangePassword} className="standard-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="action-btn"
              disabled={submittingPassword}
              style={{ marginTop: '1rem', width: '100%', padding: '0.85rem' }}
            >
              {submittingPassword ? "Saving changes..." : "Update Password"}
            </button>
          </form>

          {passwordError && (
            <div className="alert-message error-alert" style={{ marginTop: '1.5rem' }}>
              <strong>Error:</strong> {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="alert-message success-alert" style={{ marginTop: '1.5rem' }}>
              <strong>Success:</strong> {passwordSuccess}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
