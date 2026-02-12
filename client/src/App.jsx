import { Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/admin/AdminPage.jsx';
import PlayerPage from './pages/player/PlayerPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import { PlayerProvider } from './contexts/PlayerContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';

function PlayPageWrapper() {
  return (
    <ToastProvider>
      <PlayerProvider>
        <PlayerPage />
      </PlayerProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/play" element={<PlayPageWrapper />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}
