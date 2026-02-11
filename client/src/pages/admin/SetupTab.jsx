import { useState } from 'react';
import * as api from '../../services/adminApi.js';

export default function SetupTab({ players, refreshPlayers, gameStatus }) {
  const [names, setNames] = useState('');
  const [numWolves, setNumWolves] = useState(8);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState(null);

  async function handleBulkAdd() {
    const nameList = names
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);

    if (nameList.length === 0) return;

    setLoading('bulk');
    try {
      const result = await api.bulkAddPlayers(nameList);
      setMessage({
        type: 'success',
        text: `${result.created.length} joueur(s) ajouté(s)${result.skipped.length ? `, ${result.skipped.length} ignoré(s)` : ''}`,
      });
      setNames('');
      refreshPlayers();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleAssignRoles() {
    setLoading('assign');
    try {
      const result = await api.assignRoles(numWolves);
      setMessage({
        type: 'success',
        text: `Rôles assignés : ${result.players.filter(p => p.role === 'wolf').length} loups, ${result.players.filter(p => p.role === 'villager').length} villageois`,
      });
      refreshPlayers();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleStartGame() {
    if (!confirm('Démarrer la partie ? Les joueurs verront leur rôle.')) return;

    setLoading('start');
    try {
      await api.startGame();
      setMessage({ type: 'success', text: 'Partie démarrée !' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleDeletePlayer(id, name) {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await api.deletePlayer(id);
      refreshPlayers();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const isSetup = gameStatus === 'setup';
  const rolesAssigned = players.length > 0 && players.every(p => p.role);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Bulk Add Players */}
      {isSetup && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Ajouter des joueurs</h2>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Un prénom par ligne..."
            rows={6}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-villager resize-y text-sm font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-400">
              {names.split('\n').filter(n => n.trim()).length} nom(s)
            </span>
            <button
              onClick={handleBulkAdd}
              disabled={loading === 'bulk' || !names.trim()}
              className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm font-medium"
            >
              {loading === 'bulk' ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Player List */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">
          Joueurs inscrits ({players.length})
        </h2>

        {players.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun joueur inscrit</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.map(p => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  p.role === 'wolf' ? 'bg-red-950/50 border border-red-900/50' :
                  p.role === 'villager' ? 'bg-blue-950/50 border border-blue-900/50' :
                  'bg-gray-800 border border-gray-700'
                }`}
              >
                <span className="truncate">
                  {p.name}
                  {p.role && (
                    <span className={`ml-1 text-xs ${p.role === 'wolf' ? 'text-red-400' : 'text-blue-400'}`}>
                      ({p.role === 'wolf' ? 'L' : 'V'})
                    </span>
                  )}
                </span>
                {isSetup && (
                  <button
                    onClick={() => handleDeletePlayer(p.id, p.name)}
                    className="ml-2 text-gray-500 hover:text-red-400 text-xs flex-shrink-0"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Roles & Start */}
      {isSetup && players.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
          <h2 className="text-lg font-semibold">Démarrer la partie</h2>

          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-400">Nombre de loups :</label>
            <input
              type="number"
              value={numWolves}
              onChange={(e) => setNumWolves(Number(e.target.value))}
              min={1}
              max={players.length - 1}
              className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-wolf"
            />
            <span className="text-sm text-gray-500">
              / {players.length} joueurs
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAssignRoles}
              disabled={loading === 'assign'}
              className="px-4 py-2 bg-wolf text-white rounded-lg hover:bg-red-800 disabled:opacity-50 text-sm font-medium"
            >
              {loading === 'assign' ? 'Attribution...' : 'Assigner les rôles'}
            </button>

            <button
              onClick={handleStartGame}
              disabled={loading === 'start' || !rolesAssigned}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
            >
              {loading === 'start' ? 'Démarrage...' : 'Démarrer la partie'}
            </button>
          </div>

          {!rolesAssigned && players.length > 0 && (
            <p className="text-sm text-yellow-400">
              Assignez les rôles avant de démarrer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
