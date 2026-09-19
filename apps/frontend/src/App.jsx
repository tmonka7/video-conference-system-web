import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { PageLoader } from '@/components/ui';
import AppLayout from '@/components/AppLayout';
import About from '@/pages/About';
import Chat from '@/pages/Chat';
import Contacts from '@/pages/Contacts';
import Files from '@/pages/Files';
import ForgotPassword from '@/pages/ForgotPassword';
import Home from '@/pages/Home';
import Join from '@/pages/Join';
import MeetingRoom from '@/pages/MeetingRoom';
import Meetings from '@/pages/Meetings';
import Settings from '@/pages/Settings';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
import Splash from '@/pages/Splash';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Loading your account" />;
  // Remember where they were headed, so sign-in can send them back.
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route
        path="/signin"
        element={
          <GuestOnly>
            <SignIn />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignUp />
          </GuestOnly>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Joining works signed in or as a guest. */}
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      {/* The room is full screen, so it sits outside the sidebar layout. */}
      <Route path="/meeting/:code" element={<MeetingRoom />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:conversationId" element={<Chat />} />
        <Route path="files" element={<Files />} />
        <Route path="settings" element={<Settings />} />
        <Route path="about" element={<About />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
