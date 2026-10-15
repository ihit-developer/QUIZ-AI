import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { PageSkeletonLoader } from './components/ui/Skeleton';

// Lazy-loaded routes for optimal loading performance & zero jank
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
const Profile = lazy(() => import('./pages/dashboard/Profile').then((m) => ({ default: m.Profile })));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const Join = lazy(() => import('./pages/quiz/Join').then((m) => ({ default: m.Join })));
const QuizBuilder = lazy(() => import('./pages/quiz/QuizBuilder').then((m) => ({ default: m.QuizBuilder })));
const AttemptRoom = lazy(() => import('./pages/quiz/AttemptRoom').then((m) => ({ default: m.AttemptRoom })));
const Results = lazy(() => import('./pages/quiz/Results').then((m) => ({ default: m.Results })));
const HostAnalytics = lazy(() => import('./pages/quiz/HostAnalytics').then((m) => ({ default: m.HostAnalytics })));
const LiveRoom = lazy(() => import('./pages/quiz/LiveRoom').then((m) => ({ default: m.LiveRoom })));
const AIPredictions = lazy(() => import('./pages/quiz/AIPredictions').then((m) => ({ default: m.AIPredictions })));

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
          Verifying security session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="app-page" style={{ maxWidth: 620, margin: '3rem auto', textAlign: 'center' }}><h1 style={{ color: 'var(--text)' }}>This page is for host accounts</h1><p style={{ color: 'var(--text-muted)', margin: '0.75rem 0 1.25rem' }}>Your account is currently a {user.role}. Ask an administrator to change your role to host if you need to create quizzes.</p><Link className="btn-primary" to="/dashboard">Back to dashboard</Link></div>;
  }

  return children;
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              },
              success: {
                iconTheme: {
                  primary: 'var(--hero)',
                  secondary: 'var(--on-primary)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--primary)',
                  secondary: 'var(--on-primary)',
                },
              },
            }}
          />
          <MainLayout>
            <Suspense fallback={<PageSkeletonLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/join" element={<Join />} />
                <Route path="/join/:code" element={<Join />} />
                <Route path="/live/:code" element={<LiveRoom />} />
                <Route path="/attempt/:attemptId" element={<AttemptRoom />} />
                <Route path="/results/:attemptId" element={<Results />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/create-quiz"
                  element={
                    <ProtectedRoute allowedRoles={['host']}>
                      <QuizBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/edit-quiz/:id"
                  element={
                    <ProtectedRoute allowedRoles={['host']}>
                      <QuizBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics/:quizId"
                  element={
                    <ProtectedRoute allowedRoles={['host', 'admin']}>
                      <HostAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute allowedRoles={['host', 'admin']}>
                      <HostAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predictions"
                  element={
                    <ProtectedRoute>
                      <AIPredictions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </MainLayout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
