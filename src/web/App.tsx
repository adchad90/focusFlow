import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Spinner from './components/Spinner';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import ProfilePage from './pages/ProfilePage';
import InterestsPage from './pages/InterestsPage';
import FeedPage from './pages/FeedPage';
import HistoryPage from './pages/HistoryPage';
import LikedPage from './pages/LikedPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner text="Loading FocusFlow configuration..." />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/interests" element={<InterestsPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/liked" element={<LikedPage />} />
        <Route path="/" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
