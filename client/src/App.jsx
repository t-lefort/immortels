import { Routes, Route, Navigate } from 'react-router-dom';

function PlayPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Les Immortels</h1>
        <p className="text-villager text-lg">Interface Joueur</p>
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Les Immortels</h1>
        <p className="text-wolf text-lg">Administration</p>
      </div>
    </div>
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
      <Route path="/play" element={<PlayPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}
