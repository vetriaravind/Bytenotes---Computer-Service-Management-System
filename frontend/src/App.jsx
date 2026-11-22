import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Role Dashboards
import AdminDashboard from './pages/admin/AdminDashboard';
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import CustomerDashboard from './pages/customer/CustomerDashboard';

// Public Tracker
import TicketTrackerPage from './pages/public/TicketTrackerPage';
import { LoadingSpinner } from './components/common/Modal';

// Protected Route Guard with RBAC
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner text="Checking authentication credentials..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their default dashboard if unauthorized for this specific role route
    switch (user.role) {
      case 'ADMIN':
        return <Navigate to="/admin" replace />;
      case 'RECEPTIONIST':
        return <Navigate to="/receptionist" replace />;
      case 'TECHNICIAN':
        return <Navigate to="/technician" replace />;
      case 'CUSTOMER':
      default:
        return <Navigate to="/customer" replace />;
    }
  }

  return children;
};

// Root Redirect Component
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'RECEPTIONIST':
      return <Navigate to="/receptionist" replace />;
    case 'TECHNICIAN':
      return <Navigate to="/technician" replace />;
    case 'CUSTOMER':
    default:
      return <Navigate to="/customer" replace />;
  }
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/track" element={<TicketTrackerPage />} />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receptionist/*"
              element={
                <ProtectedRoute allowedRoles={['RECEPTIONIST', 'ADMIN']}>
                  <ReceptionistDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/technician/*"
              element={
                <ProtectedRoute allowedRoles={['TECHNICIAN', 'ADMIN']}>
                  <TechnicianDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/*"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Default Catch-All */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
