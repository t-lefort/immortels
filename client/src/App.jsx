import { Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/admin/AdminPage.jsx';
import PlayerPage from './pages/player/PlayerPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import { PlayerProvider } from './contexts/PlayerContext.jsx';

function PlayPageWrapper() {
  return (
    <PlayerProvider>
      <PlayerPage />
    </PlayerProvider>
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
