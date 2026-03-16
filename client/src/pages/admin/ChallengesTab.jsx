import { useState, useEffect } from 'react';
import * as api from '../../services/adminApi.js';

const SPECIAL_ROLES = [
  { value: 'maire', label: 'Maire' },
  { value: 'sorciere', label: 'Sorcière' },
  { value: 'protecteur', label: 'Protecteur' },
  { value: 'voyante', label: 'Voyante' },
  { value: 'chasseur', label: 'Chasseur' },
  { value: 'immunite', label: 'Immunité' },
];

export default function ChallengesTab({ players, refreshPlayers }) {
  const [challenges, setChallenges] = useState([]);
  const [name, setName] = useState('');
  const [specialRole, setSpecialRole] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [assignPlayerId, setAssignPlayerId] = useState('');
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState(null);

  // Challenge display state
  const [displayName, setDisplayName] = useState('');
  const [displayActive, setDisplayActive] = useState(false);

  useEffect(() => {
    loadChallenges();
  }, []);

  async function loadChallenges() {
    try {
      const data = await api.getChallenges();
      setChallenges(data);
    } catch { /* ignore */ }
  }

  async function handleCreate() {
    if (!name.trim()) return;

    setLoading('create');
    try {
      await api.createChallenge({
        name: name.trim(),
        specialRole: specialRole || null,
        winningPlayerIds: selectedPlayers,
      });
      setName('');
      setSelectedPlayers([]);
      loadChallenges();
      refreshPlayers();
      setMessage({ type: 'success', text: 'Épreuve enregistrée' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleAssign(challengeId) {
    if (!assignPlayerId) return;

    setLoading('assign');
    try {
      const result = await api.assignChallenge(challengeId, Number(assignPlayerId));
      setAssignPlayerId('');
      loadChallenges();
      refreshPlayers();
      setMessage({ type: 'success', text: `Rôle "${result.specialRole}" attribué` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleDisplayChallenge() {
    if (!displayName.trim()) return;
    setLoading('display');
    try {
      await api.displayChallenge(displayName.trim());
      setDisplayActive(true);
      setMessage({ type: 'success', text: `Épreuve "${displayName.trim()}" affichée sur le dashboard` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleClearDisplay() {
    setLoading('clear-display');
    try {
      await api.clearChallengeDisplay();
      setDisplayActive(false);
      setDisplayName('');
      setMessage({ type: 'success', text: 'Affichage épreuve retiré' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  function togglePlayer(id) {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  const activePlayers = players.filter(p => p.status === 'alive' || p.status === 'ghost');
  // All active players are available — players can now have multiple special roles
  const availablePlayers = activePlayers;

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

      {/* Challenge Display on Dashboard */}
      <div className="bg-gray-900 rounded-lg p-4 border border-yellow-900/50">
        <h2 className="text-lg font-semibold mb-3 text-yellow-400">Afficher une épreuve sur le dashboard</h2>

        {!displayActive ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDisplayChallenge()}
              placeholder="Nom de l'épreuve..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600 text-sm"
            />
            <button
              onClick={handleDisplayChallenge}
              disabled={loading === 'display' || !displayName.trim()}
              className="px-4 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
            >
              {loading === 'display' ? 'Envoi...' : 'Afficher'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-medium">En cours :</span>
              <span className="text-white text-sm">{displayName}</span>
            </div>
            <button
              onClick={handleClearDisplay}
              disabled={loading === 'clear-display'}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
            >
              {loading === 'clear-display' ? 'Retrait...' : 'Retirer l\'affichage'}
            </button>
          </div>
        )}
      </div>

      {/* Create Challenge */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Nouvelle épreuve</h2>

        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de l'épreuve..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-villager text-sm"
          />

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Rôle attribué :</label>
            <select
              value={specialRole}
              onChange={(e) => setSpecialRole(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">Aucun (points uniquement)</option>
              {SPECIAL_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Team selection */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Équipe gagnante ({selectedPlayers.length} joueurs) :
            </label>
            <div className="flex flex-wrap gap-1.5">
              {activePlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    selectedPlayers.includes(p.id)
                      ? 'bg-villager text-white'
                      : p.status === 'ghost'
                        ? 'bg-gray-800 text-ghost hover:bg-gray-700'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p.name}{p.status === 'ghost' ? ' 👻' : ''}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading === 'create' || !name.trim()}
            className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm font-medium"
          >
            {loading === 'create' ? 'Enregistrement...' : 'Enregistrer l\'épreuve'}
          </button>
        </div>
      </div>

      {/* Existing Challenges */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Épreuves ({challenges.length})</h2>

        {challenges.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune épreuve enregistrée</p>
        ) : (
          <div className="space-y-3">
            {challenges.map(ch => (
              <div key={ch.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{ch.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                    {ch.special_role_awarded || 'Points uniquement'}
                  </span>
                </div>

                {ch.special_role_awarded ? (
                  ch.awarded_to_player_id ? (
                    <div className="text-sm text-green-400">
                      Attribué à {players.find(p => p.id === ch.awarded_to_player_id)?.name || `#${ch.awarded_to_player_id}`}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={assignPlayerId}
                        onChange={(e) => setAssignPlayerId(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                      >
                        <option value="">Choisir un joueur...</option>
                        {availablePlayers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(ch.id)}
                        disabled={!assignPlayerId || loading === 'assign'}
                        className="px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                      >
                        Attribuer
                      </button>
                    </div>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
