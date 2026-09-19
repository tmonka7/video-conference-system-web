import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Loading } from '@/components/ui';
import AuditLogs from '@/pages/AuditLogs';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Meetings from '@/pages/Meetings';
import Users from '@/pages/Users';

function RequireAdmin({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <Loading label="Checking your access" />;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoutes() {
  const { admin, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Loading /> : admin ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="audit" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  );
}
