import { Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/admin/AdminPage.jsx';
import PlayerPage from './pages/player/PlayerPage.jsx';
import { PlayerProvider } from './contexts/PlayerContext.jsx';

function PlayPageWrapper() {
  return (
    <PlayerProvider>
      <PlayerPage />
    </PlayerProvider>
  );
}

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Les Immortels</h1>
        <p className="text-ghost text-lg">Dashboard</p>
      </div>
    </div>
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
