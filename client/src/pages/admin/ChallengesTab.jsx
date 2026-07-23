import { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/adminApi.js';

const SPECIAL_ROLES = [
  { value: 'maire', label: 'Maire' },
  { value: 'sorciere', label: 'Sorcière' },
  { value: 'protecteur', label: 'Protecteur' },
  { value: 'voyante', label: 'Voyante' },
  { value: 'chasseur', label: 'Chasseur' },
  { value: 'immunite', label: 'Immunité' },
];

function roleLabel(value) {
  return SPECIAL_ROLES.find(r => r.value === value)?.label || value;
}

/**
 * Épreuves tab.
 *
 * An épreuve is entered once and then walked through its three steps in
 * place: announce it on the dashboard, record the winning team, hand out the
 * special role. Previously the name had to be retyped for the announcement
 * and again for the record, and the steps lived in unrelated panels.
 */
export default function ChallengesTab({ players, refreshPlayers }) {
  const [challenges, setChallenges] = useState([]);
  const [name, setName] = useState('');
  const [specialRole, setSpecialRole] = useState('');
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState(null);

  // Name currently announced on the dashboard, null when nothing is displayed
  const [displayedName, setDisplayedName] = useState(null);

  const loadChallenges = useCallback(async () => {
    try {
      setChallenges(await api.getChallenges());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  function notify(type, text) {
    setMessage({ type, text });
  }

  /**
   * Step 1 — create the épreuve. Winners are recorded afterwards, from the
   * épreuve's own card, so the name is only ever typed here.
   */
  async function handleCreate() {
    const cleanName = name.trim();
    if (!cleanName) return;

    setLoading('create');
    try {
      await api.createChallenge({
        name: cleanName,
        specialRole: specialRole || null,
        winningPlayerIds: [],
      });
      setName('');
      setSpecialRole('');
      await loadChallenges();
      notify('success', `Épreuve « ${cleanName} » créée`);
    } catch (err) {
      notify('error', err.message);
    }
    setLoading('');
  }

  async function handleAnnounce(challenge) {
    setLoading(`announce-${challenge.id}`);
    try {
      await api.displayChallenge(challenge.name);
      setDisplayedName(challenge.name);
      notify('success', `« ${challenge.name} » affichée sur le dashboard`);
    } catch (err) {
      notify('error', err.message);
    }
    setLoading('');
  }

  async function handleClearDisplay() {
    setLoading('clear-display');
    try {
      await api.clearChallengeDisplay();
      setDisplayedName(null);
      notify('success', 'Affichage retiré du dashboard');
    } catch (err) {
      notify('error', err.message);
    }
    setLoading('');
  }

  async function handleSaveWinners(challenge, winnerIds) {
    setLoading(`winners-${challenge.id}`);
    try {
      const result = await api.setChallengeWinners(challenge.id, winnerIds);
      await loadChallenges();
      refreshPlayers();
      notify(
        'success',
        `${winnerIds.length} gagnant(s) enregistré(s) — ${result.scoreChanges.length} point(s) attribué(s)`
      );
    } catch (err) {
      notify('error', err.message);
    }
    setLoading('');
  }

  async function handleAssign(challenge, playerId) {
    setLoading(`assign-${challenge.id}`);
    try {
      const result = await api.assignChallenge(challenge.id, Number(playerId));
      await loadChallenges();
      refreshPlayers();
      notify('success', `Rôle « ${roleLabel(result.specialRole)} » attribué`);
    } catch (err) {
      notify('error', err.message);
    }
    setLoading('');
  }

  const eligiblePlayers = players.filter(p => p.status === 'alive' || p.status === 'ghost');

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

      {/* Dashboard banner — only shown when something is on screen */}
      {displayedName && (
        <div className="bg-yellow-950/30 rounded-lg px-4 py-3 border border-yellow-900/50 flex items-center justify-between gap-3">
          <span className="text-sm text-yellow-300">
            Affiché sur le dashboard : <span className="text-white font-medium">{displayedName}</span>
          </span>
          <button
            onClick={handleClearDisplay}
            disabled={loading === 'clear-display'}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
          >
            Retirer
          </button>
        </div>
      )}

      {/* Step 1 — create */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-1">Nouvelle épreuve</h2>
        <p className="text-xs text-gray-500 mb-3">
          Le nom n'est saisi qu'ici. Les gagnants et le rôle se renseignent ensuite sur la fiche de l'épreuve.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nom de l'épreuve..."
            className="flex-1 min-w-[12rem] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-villager text-sm"
          />
          <select
            value={specialRole}
            onChange={(e) => setSpecialRole(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none"
          >
            <option value="">Aucun rôle (points uniquement)</option>
            {SPECIAL_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={loading === 'create' || !name.trim()}
            className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            {loading === 'create' ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>

      {/* Existing challenges — each one carries its own steps */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Épreuves ({challenges.length})</h2>

        {challenges.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune épreuve enregistrée</p>
        ) : (
          challenges.map(ch => (
            <ChallengeCard
              key={ch.id}
              challenge={ch}
              players={eligiblePlayers}
              loading={loading}
              isAnnounced={displayedName === ch.name}
              onAnnounce={() => handleAnnounce(ch)}
              onClearDisplay={handleClearDisplay}
              onSaveWinners={(ids) => handleSaveWinners(ch, ids)}
              onAssign={(playerId) => handleAssign(ch, playerId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One épreuve and its three steps, each collapsing once done.
 */
function ChallengeCard({
  challenge, players, loading, isAnnounced,
  onAnnounce, onClearDisplay, onSaveWinners, onAssign,
}) {
  const savedWinners = parseWinners(challenge.winning_team_player_ids);
  const [selected, setSelected] = useState(savedWinners);
  const [editingWinners, setEditingWinners] = useState(savedWinners.length === 0);
  const [assignPlayerId, setAssignPlayerId] = useState('');

  // Re-sync when the server copy changes (another admin tab, a reload)
  useEffect(() => {
    setSelected(savedWinners);
    setEditingWinners(savedWinners.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.winning_team_player_ids]);

  const awardsRole = !!challenge.special_role_awarded;
  const roleAssigned = !!challenge.awarded_to_player_id;
  const winnersRecorded = savedWinners.length > 0;
  const complete = winnersRecorded && (!awardsRole || roleAssigned);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  return (
    <div className={`bg-gray-900 rounded-lg border ${
      complete ? 'border-gray-800' : 'border-villager/40'
    }`}>
      {/* Title row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800">
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{challenge.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {awardsRole ? `Rôle : ${roleLabel(challenge.special_role_awarded)}` : 'Points uniquement'}
            {winnersRecorded && ` · ${savedWinners.length} gagnant(s)`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {complete && <span className="text-green-500 text-xs">Terminée</span>}
          {isAnnounced ? (
            <button
              onClick={onClearDisplay}
              disabled={loading === 'clear-display'}
              className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
            >
              Retirer du dashboard
            </button>
          ) : (
            <button
              onClick={onAnnounce}
              disabled={loading === `announce-${challenge.id}`}
              className="px-3 py-1.5 bg-yellow-800 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
            >
              Annoncer
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Step 2 — winning team */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">
              Équipe gagnante
              {editingWinners && ` (${selected.length} sélectionné(s))`}
            </label>
            {winnersRecorded && !editingWinners && (
              <button
                onClick={() => setEditingWinners(true)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Modifier
              </button>
            )}
          </div>

          {editingWinners ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      selected.includes(p.id)
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
              <button
                onClick={() => {
                  onSaveWinners(selected);
                  setEditingWinners(false);
                }}
                disabled={loading === `winners-${challenge.id}` || selected.length === 0}
                className="px-3 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-xs font-medium"
              >
                {loading === `winners-${challenge.id}` ? 'Enregistrement...' : 'Enregistrer les gagnants (+1 pt chacun)'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-300">
              {savedWinners
                .map(id => players.find(p => p.id === id)?.name || `#${id}`)
                .join(', ')}
            </p>
          )}
        </div>

        {/* Step 3 — special role */}
        {awardsRole && (
          <div className="border-t border-gray-800 pt-3">
            <label className="text-sm text-gray-400 block mb-2">
              Attribution du rôle « {roleLabel(challenge.special_role_awarded)} »
            </label>

            {roleAssigned ? (
              <p className="text-sm text-green-400">
                Attribué à {players.find(p => p.id === challenge.awarded_to_player_id)?.name || `#${challenge.awarded_to_player_id}`}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={assignPlayerId}
                  onChange={(e) => setAssignPlayerId(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                  <option value="">Choisir un joueur...</option>
                  {/* Winners first: the role normally goes to someone on the winning team */}
                  {sortWinnersFirst(players, savedWinners).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{savedWinners.includes(p.id) ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onAssign(assignPlayerId)}
                  disabled={!assignPlayerId || loading === `assign-${challenge.id}`}
                  className="px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  Attribuer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function parseWinners(json) {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function sortWinnersFirst(players, winnerIds) {
  const isWinner = (p) => (winnerIds.includes(p.id) ? 0 : 1);
  return [...players].sort((a, b) => isWinner(a) - isWinner(b) || a.name.localeCompare(b.name));
}
