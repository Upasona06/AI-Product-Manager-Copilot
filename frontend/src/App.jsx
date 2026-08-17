import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Page Imports
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import UploadCSVPage from './pages/UploadCSVPage';
import FeedbackFormPage from './pages/FeedbackFormPage';
import StatusPage from './pages/StatusPage';
import ClassificationPage from './pages/ClassificationPage';
import AggregationPage from './pages/AggregationPage';
import PrioritizationPage from './pages/PrioritizationPage';
import PRDGeneratorPage from './pages/PRDGeneratorPage';
import AssistantPage from './pages/AssistantPage';
import UserStoriesPage from './pages/UserStoriesPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') || 'default';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Navbar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} />

          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={handleToggleSidebar}
              className="sidebar-floating-toggle-btn"
              title="Enable / Expand Sidebar"
            >
              <span>☰</span>
              <span>Menu</span>
            </button>
          )}

          <main className="main-content-layout">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Product Manager Only Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload/csv"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <UploadCSVPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/status"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <StatusPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classify"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <ClassificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aggregate"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <AggregationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prioritization"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <PrioritizationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prd-generator"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <PRDGeneratorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user-stories"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <UserStoriesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['product_manager', 'customer']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute allowedRoles={['product_manager']}>
                    <AssistantPage />
                  </ProtectedRoute>
                }
              />


              {/* Protected Combined Routes (PM & Customer) */}
              <Route
                path="/upload/feedback"
                element={
                  <ProtectedRoute allowedRoles={['product_manager', 'customer']}>
                    <FeedbackFormPage />
                  </ProtectedRoute>
                }
              />

              {/* Root redirects to login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
