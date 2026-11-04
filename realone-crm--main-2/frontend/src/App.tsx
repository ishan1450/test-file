import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { InitialAdminSetup } from './pages/InitialAdminSetup';
import { Register } from './pages/Register';
import { PendingApproval } from './pages/PendingApproval';
import { RejectedAccount } from './pages/RejectedAccount';
import { Unauthorized } from './pages/Unauthorized';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { LeadDetails } from './pages/LeadDetails';
import { AccountApprovals } from './pages/AccountApprovals';
import { Agents } from './pages/Agents';
import { MetaSettings } from './pages/MetaSettings';
import { Profile } from './pages/Profile';
import { InitialCleanup } from './pages/InitialCleanup';
import { RefreshCw } from 'lucide-react';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-xs font-medium">Verifying authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.approval_status === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (user?.approval_status === 'rejected') {
    return <Navigate to="/rejected-account" replace />;
  }

  return <>{children}</>;
};

// Admin Only Route Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/initial-admin-setup" element={<InitialAdminSetup />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/rejected-account" element={<RejectedAccount />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected App Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetails />} />
            <Route path="profile" element={<Profile />} />

            {/* Admin Exclusive */}
            <Route
              path="approvals"
              element={
                <AdminRoute>
                  <AccountApprovals />
                </AdminRoute>
              }
            />
            <Route
              path="agents"
              element={
                <AdminRoute>
                  <Agents />
                </AdminRoute>
              }
            />
            <Route
              path="meta"
              element={
                <AdminRoute>
                  <MetaSettings />
                </AdminRoute>
              }
            />
            <Route
              path="initial-cleanup"
              element={
                <AdminRoute>
                  <InitialCleanup />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
