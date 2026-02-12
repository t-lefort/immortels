import { useState, useEffect, useCallback } from 'react';
import AdminLogin from './AdminLogin.jsx';
import SetupTab from './SetupTab.jsx';
import PhaseControlTab from './PhaseControlTab.jsx';
import ChallengesTab from './ChallengesTab.jsx';
import PlayersTab from './PlayersTab.jsx';
import ScoresTab from './ScoresTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import ConnectionStatus from '../../components/ConnectionStatus.jsx';
import { useAdminSocket } from '../../hooks/useAdminSocket.js';
import { getPlayers, checkAuth } from '../../services/adminApi.js';

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'phases', label: 'Phases' },
  { id: 'challenges', label: 'Épreuves' },
  { id: 'players', label: 'Joueurs' },
  { id: 'scores', label: 'Scores' },
  { id: 'history', label: 'Historique' },
  { id: 'settings', label: 'Réglages' },
];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState('setup');
  const [currentPhase, setCurrentPhase] = useState(null);
  const { connected, on } = useAdminSocket();

  const refreshPlayers = useCallback(async () => {
    try {
      const data = await getPlayers();
      setPlayers(data);
    } catch { /* ignore */ }
  }, []);

  // Check existing auth on mount
  useEffect(() => {
    async function check() {
      if (localStorage.getItem('admin_password')) {
        const ok = await checkAuth();
        if (ok) setAuthenticated(true);
      }
      setChecking(false);
    }
    check();
  }, []);

  // Load initial data
  useEffect(() => {
    if (authenticated) refreshPlayers();
  }, [authenticated, refreshPlayers]);

  // Listen for socket events
  useEffect(() => {
    if (!authenticated) return;

    const unsubs = [
      on('state:sync', (data) => {
        if (data.gameStatus) setGameStatus(data.gameStatus);
        if (data.currentPhase) setCurrentPhase(data.currentPhase);
        if (data.players) setPlayers(data.players);
      }),
      on('lobby:update', () => refreshPlayers()),
      on('game:started', () => {
        setGameStatus('in_progress');
        refreshPlayers();
      }),
      on('game:end', () => setGameStatus('finished')),
      on('game:reset', () => {
        setGameStatus('setup');
        setCurrentPhase(null);
        setPlayers([]);
        setActiveTab('setup');
      }),
      on('phase:started', ({ phase }) => setCurrentPhase(phase)),
      on('phase:voting_opened', ({ phase }) => setCurrentPhase(phase)),
      on('phase:voting_closed', ({ phase }) => setCurrentPhase(phase)),
      on('phase:result', () => {
        setCurrentPhase(null);
        refreshPlayers();
      }),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [authenticated, on, refreshPlayers]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  const aliveCount = players.filter(p => p.status === 'alive').length;
  const wolfCount = players.filter(p => p.role === 'wolf' && p.status === 'alive').length;
  const ghostCount = players.filter(p => p.status === 'ghost').length;

  const statusLabels = {
    setup: 'Configuration',
    in_progress: 'En cours',
    finished: 'Terminée',
  };

  function renderTab() {
    const props = { players, refreshPlayers, gameStatus, currentPhase, setCurrentPhase };
    switch (activeTab) {
      case 'setup': return <SetupTab {...props} />;
      case 'phases': return <PhaseControlTab {...props} />;
      case 'challenges': return <ChallengesTab {...props} />;
      case 'players': return <PlayersTab {...props} />;
      case 'scores': return <ScoresTab {...props} />;
      case 'history': return <HistoryTab {...props} />;
      case 'settings': return <SettingsTab {...props} />;
      default: return null;
    }
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <ConnectionStatus connected={connected} position="top" />
      {/* Status Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-wolf">Admin</span>
          <span className="text-gray-400">
            Partie : <span className="text-white">{statusLabels[gameStatus] || gameStatus}</span>
          </span>
          {currentPhase && (
            <span className="text-gray-400">
              Phase : <span className="text-white">
                {currentPhase.type === 'night' ? 'Nuit' : 'Conseil'} #{currentPhase.id}
              </span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                currentPhase.status === 'voting' ? 'bg-yellow-900 text-yellow-300' :
                currentPhase.status === 'active' ? 'bg-green-900 text-green-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {currentPhase.status}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400">
            {aliveCount} vivants · {wolfCount} loups · {ghostCount} fantômes
          </span>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-4 overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-wolf text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-w-6xl mx-auto">
        {renderTab()}
      </div>
    </div>
  );
}
