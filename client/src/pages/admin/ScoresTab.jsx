import { useState, useEffect } from 'react';
import * as api from '../../services/adminApi.js';

export default function ScoresTab({ players, refreshPlayers, gameStatus }) {
  const [scoreboard, setScoreboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadScoreboard();
  }, [players]);

  async function loadScoreboard() {
    try {
      const data = await api.getScoreboard();
      setScoreboard(data);
    } catch { /* ignore */ }
  }

  async function handleEndGame(winner) {
    const winnerLabel = winner === 'wolves' ? 'des Loups' : 'des Villageois';
    if (!confirm(`Terminer la partie avec la victoire ${winnerLabel} ? (+3 pour chaque survivant)`)) return;

    setLoading(true);
    try {
      const result = await api.endGame(winner);
      setScoreboard(result.scoreboard);
      setMessage({
        type: 'success',
        text: `Partie terminee - Victoire ${winnerLabel}. ${result.scoreChanges.length} bonus de survie appliques.`,
      });
      refreshPlayers();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  async function handleUpdateScore(playerId, newScore) {
    try {
      await api.updatePlayer(playerId, { score: newScore });
      refreshPlayers();
      loadScoreboard();
      setEditingId(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleScoreDelta(playerId, delta) {
    const player = scoreboard.find(p => p.id === playerId);
    if (!player) return;
    await handleUpdateScore(playerId, player.score + delta);
  }

  function startEditing(player) {
    setEditingId(player.id);
    setEditValue(String(player.score));
  }

  function commitEdit(playerId) {
    const newScore = parseInt(editValue, 10);
    if (isNaN(newScore)) {
      setEditingId(null);
      return;
    }
    handleUpdateScore(playerId, newScore);
  }

  function handleEditKeyDown(e, playerId) {
    if (e.key === 'Enter') {
      commitEdit(playerId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }

  // Status display helper
  function getStatusLabel(status) {
    if (status === 'alive') return 'Vivant';
    if (status === 'ghost') return 'Fantome';
    return status;
  }

  function getStatusClass(status) {
    if (status === 'alive') return 'text-green-400';
    if (status === 'ghost') return 'text-emerald-600';
    return 'text-gray-500';
  }

  function getRoleBadge(role, specialRole) {
    const roleBadge = role === 'wolf'
      ? 'bg-red-900/50 text-red-300 border border-red-800/50'
      : 'bg-blue-900/50 text-blue-300 border border-blue-800/50';
    const roleLabel = role === 'wolf' ? 'Loup' : 'Villageois';
    const roles = specialRole ? specialRole.split(',').map(r => r.trim()).filter(Boolean) : [];

    return (
      <>
        <span className={`px-1.5 py-0.5 rounded text-xs ${roleBadge}`}>
          {roleLabel}
        </span>
        {roles.map(r => (
          <span key={r} className="ml-1 px-1.5 py-0.5 rounded text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50">
            {r}
          </span>
        ))}
      </>
    );
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

      {/* End condition indicator */}
      {gameStatus === 'in_progress' && (() => {
        const aliveWolves = scoreboard.filter(p => p.role === 'wolf' && p.status === 'alive').length;
        const aliveVillagers = scoreboard.filter(p => p.role === 'villager' && p.status === 'alive').length;
        const wolvesAllDead = aliveWolves === 0 && scoreboard.length > 0;
        const wolvesOverpower = aliveWolves >= aliveVillagers && aliveWolves > 0;

        return (
          <div className={`px-4 py-3 rounded-lg text-sm border ${
            wolvesAllDead ? 'bg-blue-900/30 border-blue-800 text-blue-300' :
            wolvesOverpower ? 'bg-red-900/30 border-red-800 text-red-300' :
            'bg-gray-900/50 border-gray-800 text-gray-400'
          }`}>
            <div className="flex items-center justify-between">
              <span>
                <strong>{aliveWolves}</strong> loup{aliveWolves !== 1 ? 's' : ''} vivant{aliveWolves !== 1 ? 's' : ''} /
                <strong> {aliveVillagers}</strong> villageois vivant{aliveVillagers !== 1 ? 's' : ''}
              </span>
              {wolvesAllDead && (
                <span className="font-bold text-blue-300">Tous les loups sont elimines — Victoire Villageois</span>
              )}
              {wolvesOverpower && (
                <span className="font-bold text-red-300">Loups &ge; Villageois — Victoire Loups</span>
              )}
              {!wolvesAllDead && !wolvesOverpower && (
                <span className="text-gray-500">Aucune condition de fin remplie</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={loadScoreboard}
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm font-medium border border-gray-700"
        >
          Rafraichir
        </button>

        <div className="flex gap-2">
          {gameStatus === 'in_progress' && (
            <>
              <button
                onClick={() => handleEndGame('villagers')}
                disabled={loading}
                className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Calcul...' : 'Fin — Victoire Villageois'}
              </button>
              <button
                onClick={() => handleEndGame('wolves')}
                disabled={loading}
                className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Calcul...' : 'Fin — Victoire Loups'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scoreboard table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Joueur</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map((p, i) => {
              // Row background: top 3 get gold tint, wolves get subtle red, ghosts get subtle green
              let rowBg = '';
              if (i < 3) {
                rowBg = 'bg-yellow-900/10';
              }

              return (
                <tr key={p.id} className={`border-b border-gray-800/50 ${rowBg}`}>
                  <td className="px-3 py-2 text-gray-500 font-mono">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${
                      p.role === 'wolf' ? 'text-red-200' :
                      p.status === 'ghost' ? 'text-emerald-200' :
                      'text-white'
                    }`}>
                      {p.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {getRoleBadge(p.role, p.special_role)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={getStatusClass(p.status)}>
                      {getStatusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editingId === p.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, p.id)}
                        onBlur={() => commitEdit(p.id)}
                        autoFocus
                        className="w-16 bg-gray-800 text-white text-right rounded px-1 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none text-lg font-bold"
                      />
                    ) : (
                      <button
                        onClick={() => startEditing(p)}
                        className="text-white font-bold text-lg hover:text-blue-300 cursor-pointer transition-colors"
                        title="Cliquer pour modifier le score"
                      >
                        {p.score}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => handleScoreDelta(p.id, -1)}
                        className="w-6 h-6 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-red-400 text-xs border border-gray-700"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleScoreDelta(p.id, 1)}
                        className="w-6 h-6 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-green-400 text-xs border border-gray-700"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {scoreboard.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-6 text-center text-gray-500">
                  Aucun joueur enregistre
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      {scoreboard.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{scoreboard.length} joueurs</span>
          <span>{scoreboard.filter(p => p.status === 'alive').length} vivants</span>
          <span>{scoreboard.filter(p => p.status === 'ghost').length} fantomes</span>
          <span>{scoreboard.filter(p => p.role === 'wolf').length} loups</span>
          <span>{scoreboard.filter(p => p.role === 'villager').length} villageois</span>
        </div>
      )}
    </div>
  );
}
