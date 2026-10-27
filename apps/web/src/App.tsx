import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import WorkspacePage from './pages/WorkspacePage';

function ProtectedRoute({ children, allowDemo = false }: { children: React.ReactNode; allowDemo?: boolean }) {
  const { user, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!configured) {
    return allowDemo
      ? <>{children}</>
      : <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function ProjectRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  if (projectId === 'demo') return <WorkspacePage />;
  return (
    <ProtectedRoute>
      <WorkspacePage />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/auth/login"
        element={
          !loading && user ? <Navigate to={returnTo} replace /> : <AuthPage mode="login" />
        }
      />
      <Route
        path="/auth/signup"
        element={
          !loading && user ? <Navigate to={returnTo} replace /> : <AuthPage mode="signup" />
        }
      />
      <Route path="/auth/reset-password" element={<AuthPage mode="reset" />} />
      <Route path="/dashboard" element={<LandingPage />} />
      <Route
        path="/projects"
        element={
          <ProtectedRoute allowDemo>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId"
        element={<ProjectRoute />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
