import { useState, useEffect } from 'react';
import * as api from '../../services/adminApi.js';

export default function ScoresTab({ players, refreshPlayers, gameStatus }) {
  const [scoreboard, setScoreboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadScoreboard();
  }, [players]);

  async function loadScoreboard() {
    try {
      const data = await api.getScoreboard();
      setScoreboard(data);
    } catch { /* ignore */ }
  }

  async function handleEndGame() {
    if (!confirm('Terminer la partie ? Les scores finaux seront calculés.')) return;

    setLoading(true);
    try {
      const result = await api.endGame();
      setScoreboard(result.scoreboard);
      setMessage({
        type: 'success',
        text: `Partie terminée. ${result.scoreChanges.length} bonus de survie appliqués.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  async function handleUpdateScore(playerId, delta) {
    try {
      const player = players.find(p => p.id === playerId);
      await api.updatePlayer(playerId, { score: player.score + delta });
      refreshPlayers();
      loadScoreboard();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
        </div>
      )}

      {gameStatus === 'in_progress' && (
        <div className="flex justify-end">
          <button
            onClick={handleEndGame}
            disabled={loading}
            className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            Terminer la partie
          </button>
        </div>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Joueur</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map((p, i) => (
              <tr key={p.id} className={`border-b border-gray-800/50 ${
                i < 3 ? 'bg-yellow-900/10' : ''
              }`}>
                <td className="px-3 py-2 text-gray-500 font-mono">{i + 1}</td>
                <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    p.role === 'wolf' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                  }`}>
                    {p.role === 'wolf' ? 'Loup' : 'Villageois'}
                  </span>
                  {p.special_role && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-purple-900/50 text-purple-300">
                      {p.special_role}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={p.status === 'alive' ? 'text-green-400' : 'text-gray-500'}>
                    {p.status === 'alive' ? 'Vivant' : 'Fantôme'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-white font-bold text-lg">{p.score}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => handleUpdateScore(p.id, -1)}
                      className="w-6 h-6 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 text-xs"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleUpdateScore(p.id, 1)}
                      className="w-6 h-6 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 text-xs"
                    >
                      +
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
