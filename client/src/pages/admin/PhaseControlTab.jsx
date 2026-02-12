import { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/adminApi.js';
import SpecialRolesPanel from './SpecialRolesPanel.jsx';

export default function PhaseControlTab({ players, refreshPlayers, gameStatus, currentPhase, setCurrentPhase }) {
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState(null);
  const [results, setResults] = useState(null);
  const [voteDetails, setVoteDetails] = useState(null);
  const [speechOrder, setSpeechOrder] = useState(null);
  const [timerDuration, setTimerDuration] = useState(60);

  const alivePlayers = players.filter(p => p.status === 'alive');
  const isInProgress = gameStatus === 'in_progress';

  const loadResults = useCallback(async (phaseId) => {
    try {
      const data = await api.getPhaseResults(phaseId);
      setResults(data.results);
    } catch (err) {
      console.warn('Could not load results:', err.message);
    }
  }, []);

  const loadVoteDetails = useCallback(async (phaseId) => {
    try {
      const data = await api.getPhaseVotes(phaseId);
      setVoteDetails(data);
    } catch (err) {
      console.warn('Could not load votes:', err.message);
    }
  }, []);

  // Auto-load results when phase is completed or voting
  useEffect(() => {
    if (currentPhase && (currentPhase.status === 'completed' || currentPhase.status === 'voting')) {
      loadResults(currentPhase.id);
      loadVoteDetails(currentPhase.id);
    }
  }, [currentPhase, loadResults, loadVoteDetails]);

  async function handleCreatePhase(type) {
    setLoading('create');
    setResults(null);
    setVoteDetails(null);
    setSpeechOrder(null);
    try {
      const phase = await api.createPhase(type);
      setCurrentPhase(phase);
      setMessage({ type: 'success', text: `Phase ${type === 'night' ? 'Nuit' : 'Conseil'} #${phase.id} créée` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleStartPhase() {
    if (!currentPhase) return;
    setLoading('start');
    try {
      const phase = await api.startPhase(currentPhase.id);
      setCurrentPhase(phase);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleOpenVoting() {
    if (!currentPhase) return;
    setLoading('voting');
    try {
      const phase = await api.openVoting(currentPhase.id);
      setCurrentPhase(phase);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleCloseVoting() {
    if (!currentPhase) return;
    setLoading('close');
    try {
      const phase = await api.closeVoting(currentPhase.id);
      setCurrentPhase(phase);
      loadResults(currentPhase.id);
      loadVoteDetails(currentPhase.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleReveal(victims = []) {
    if (!currentPhase) return;
    if (!confirm(`Révéler les résultats${victims.length > 0 ? ` (${victims.length} victime(s))` : ''} ?`)) return;

    setLoading('reveal');
    try {
      const data = await api.revealPhase(currentPhase.id, victims);
      setCurrentPhase(null);
      setResults(null);
      setVoteDetails(null);
      refreshPlayers();
      setMessage({
        type: 'success',
        text: `Résultats révélés. ${data.eliminated.length} éliminé(s). ${data.scoreChanges.length} changements de score.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleSkipPhase() {
    if (!currentPhase) return;
    if (!confirm('Passer cette phase ?')) return;

    setLoading('skip');
    try {
      await api.skipPhase(currentPhase.id);
      setCurrentPhase(null);
      setResults(null);
      setVoteDetails(null);
      setMessage({ type: 'success', text: 'Phase passée' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleSpeechOrder() {
    setLoading('speech');
    try {
      const data = await api.generateSpeechOrder();
      setSpeechOrder(data.order);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleBroadcastSpeechOrder() {
    if (!speechOrder) return;
    setLoading('broadcast');
    try {
      await api.broadcastSpeechOrder(speechOrder);
      setMessage({ type: 'success', text: 'Ordre de parole envoyé au dashboard' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleStartTimer() {
    try {
      await api.startTimer(timerDuration);
      setMessage({ type: 'success', text: `Timer ${timerDuration}s lancé` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleRefreshVotes() {
    if (!currentPhase) return;
    loadVoteDetails(currentPhase.id);
    loadResults(currentPhase.id);
    setMessage({ type: 'success', text: 'Votes rafraîchis' });
  }

  if (!isInProgress) {
    return (
      <div className="text-gray-400 text-center py-12">
        La partie n'est pas en cours.
      </div>
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

      {/* Phase Creation */}
      {!currentPhase && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Nouvelle phase</h2>
          <div className="flex gap-3">
            <button
              onClick={() => handleCreatePhase('night')}
              disabled={!!loading}
              className="flex-1 py-3 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
            >
              Nuit
            </button>
            <button
              onClick={() => handleCreatePhase('village_council')}
              disabled={!!loading}
              className="flex-1 py-3 bg-yellow-800 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium"
            >
              Conseil du village
            </button>
          </div>
        </div>
      )}

      {/* Phase Controls */}
      {currentPhase && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {currentPhase.type === 'night' ? 'Nuit' : 'Conseil du Village'} #{currentPhase.id}
            </h2>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              currentPhase.status === 'pending' ? 'bg-gray-700 text-gray-300' :
              currentPhase.status === 'active' ? 'bg-green-900 text-green-300' :
              currentPhase.status === 'voting' ? 'bg-yellow-900 text-yellow-300' :
              'bg-blue-900 text-blue-300'
            }`}>
              {currentPhase.status}
            </span>
          </div>

          {/* Phase Lifecycle Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {currentPhase.status === 'pending' && (
              <button
                onClick={handleStartPhase}
                disabled={!!loading}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
              >
                Lancer la phase
              </button>
            )}
            {currentPhase.status === 'active' && currentPhase.type !== 'night' && (
              <button
                onClick={handleOpenVoting}
                disabled={!!loading}
                className="px-4 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium"
              >
                Ouvrir les votes
              </button>
            )}
            {currentPhase.status === 'voting' && (
              <>
                <button
                  onClick={handleCloseVoting}
                  disabled={!!loading}
                  className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
                >
                  Fermer les votes
                </button>
                <button
                  onClick={handleRefreshVotes}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium"
                >
                  Rafraîchir
                </button>
              </>
            )}
            <button
              onClick={handleSkipPhase}
              disabled={!!loading}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
            >
              Passer
            </button>
          </div>

          {/* Council-specific: Speech Order + Timer */}
          {currentPhase.type === 'village_council' && (
            <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSpeechOrder}
                  disabled={!!loading}
                  className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm"
                >
                  Ordre de parole
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={timerDuration}
                    onChange={(e) => setTimerDuration(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    min={10}
                  />
                  <span className="text-xs text-gray-400">sec</span>
                  <button
                    onClick={handleStartTimer}
                    className="px-3 py-1.5 bg-yellow-800 text-white rounded-lg hover:bg-yellow-700 text-sm"
                  >
                    Timer
                  </button>
                </div>
              </div>

              {speechOrder && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-400">Ordre de parole :</h3>
                    <button
                      onClick={handleBroadcastSpeechOrder}
                      disabled={!!loading}
                      className="px-3 py-1 bg-yellow-800 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-xs font-medium"
                    >
                      {loading === 'broadcast' ? 'Envoi...' : 'Afficher sur le dashboard'}
                    </button>
                  </div>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {speechOrder.map((p, i) => (
                      <li key={p.id} className="text-gray-200">{p.name}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Special Roles Panel */}
      {currentPhase && (
        <SpecialRolesPanel players={players} currentPhase={currentPhase} />
      )}

      {/* Force Vote Panel */}
      {currentPhase && currentPhase.status === 'voting' && (
        <ForceVotePanel
          players={players}
          currentPhase={currentPhase}
          voteDetails={voteDetails}
          onVoteForced={() => {
            loadVoteDetails(currentPhase.id);
            loadResults(currentPhase.id);
          }}
        />
      )}

      {/* Vote Details */}
      {voteDetails && currentPhase && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Votes en détail</h2>

          {currentPhase.type === 'night' && (
            <div className="space-y-4">
              {voteDetails.wolfResults?.length > 0 && (
                <VoteSection title="Votes loups" results={voteDetails.wolfResults} color="text-red-400" />
              )}
              {voteDetails.villagerGuessResults?.length > 0 && (
                <VoteSection title="Devinettes villageois" results={voteDetails.villagerGuessResults} color="text-blue-400" />
              )}
              {voteDetails.ghostResults?.length > 0 && (
                <VoteSection title="Votes fantômes" results={voteDetails.ghostResults} color="text-green-400" />
              )}
            </div>
          )}

          {currentPhase.type === 'village_council' && voteDetails.villageResults?.length > 0 && (
            <VoteSection title="Votes du conseil" results={voteDetails.villageResults} color="text-yellow-400" />
          )}

          {voteDetails.details?.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">
                Détail individuel ({voteDetails.details.length} votes)
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                {voteDetails.details.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-gray-300">
                    <span className={`px-1.5 py-0.5 rounded ${
                      v.vote_type === 'wolf' ? 'bg-red-900/50 text-red-300' :
                      v.vote_type === 'village' ? 'bg-yellow-900/50 text-yellow-300' :
                      v.vote_type === 'villager_guess' ? 'bg-blue-900/50 text-blue-300' :
                      'bg-green-900/50 text-green-300'
                    }`}>
                      {v.vote_type}
                    </span>
                    <span>{v.voter_name}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span>{v.target_name || '(abstention)'}</span>
                    {!v.is_valid && <span className="text-red-400">(invalide)</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Night Results & Resolution */}
      {results && currentPhase && currentPhase.type === 'night' && (
        <NightResultsPanel
          results={results}
          currentPhase={currentPhase}
          players={players}
          loading={loading}
          onReveal={handleReveal}
        />
      )}

      {/* Council Results & Resolution */}
      {results && currentPhase && currentPhase.type === 'village_council' && (
        <CouncilResultsPanel
          results={results}
          currentPhase={currentPhase}
          loading={loading}
          onReveal={handleReveal}
        />
      )}
    </div>
  );
}

function ForceVotePanel({ players, currentPhase, voteDetails, onVoteForced }) {
  const [selectedVoter, setSelectedVoter] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [selectedVoteType, setSelectedVoteType] = useState('');
  const [forceLoading, setForceLoading] = useState(false);
  const [forceMessage, setForceMessage] = useState(null);

  // Determine which vote types are relevant for this phase
  const isNight = currentPhase.type === 'night';
  const voteTypes = isNight
    ? [
        { value: 'wolf', label: 'Loup' },
        { value: 'villager_guess', label: 'Devinette villageois' },
        { value: 'ghost_eliminate', label: 'Fantôme' },
      ]
    : [{ value: 'village', label: 'Conseil du village' }];

  // Build set of voter IDs who already voted, keyed by vote type
  const votedByType = {};
  if (voteDetails?.details) {
    for (const v of voteDetails.details) {
      if (!votedByType[v.vote_type]) votedByType[v.vote_type] = new Set();
      votedByType[v.vote_type].add(v.voter_id);
    }
  }

  // Determine eligible voters based on selected vote type
  const getEligibleVoters = () => {
    if (!selectedVoteType) return [];
    const alreadyVoted = votedByType[selectedVoteType] || new Set();

    return players.filter(p => {
      // Skip players who already voted for this type
      if (alreadyVoted.has(p.id)) return false;

      switch (selectedVoteType) {
        case 'wolf':
          return p.role === 'wolf' && p.status === 'alive';
        case 'villager_guess':
          // Villager guess is normally for alive villagers, but admin can force for any alive player
          return p.status === 'alive';
        case 'ghost_eliminate':
          return p.status === 'ghost';
        case 'village':
          return p.status === 'alive';
        default:
          return false;
      }
    });
  };

  // Determine eligible targets based on selected vote type
  const getEligibleTargets = () => {
    if (!selectedVoteType) return [];

    switch (selectedVoteType) {
      case 'wolf':
        // Wolves vote for alive non-wolves
        return players.filter(p => p.status === 'alive' && p.role !== 'wolf');
      case 'villager_guess':
        // Villagers guess another alive player
        return players.filter(p => p.status === 'alive' && p.id !== Number(selectedVoter));
      case 'ghost_eliminate':
        // Ghosts vote for alive players
        return players.filter(p => p.status === 'alive');
      case 'village':
        // Village council: alive players vote for alive players
        return players.filter(p => p.status === 'alive' && p.id !== Number(selectedVoter));
      default:
        return [];
    }
  };

  const eligibleVoters = getEligibleVoters();
  const eligibleTargets = getEligibleTargets();

  async function handleForceVote() {
    if (!selectedVoter || !selectedTarget || !selectedVoteType) return;

    const voter = players.find(p => p.id === Number(selectedVoter));
    const target = players.find(p => p.id === Number(selectedTarget));

    if (!confirm(`Forcer le vote de ${voter?.name} pour ${target?.name} (${selectedVoteType}) ?`)) return;

    setForceLoading(true);
    setForceMessage(null);
    try {
      const result = await api.forceVote(
        currentPhase.id,
        Number(selectedVoter),
        Number(selectedTarget),
        selectedVoteType
      );
      setForceMessage({
        type: 'success',
        text: `Vote forcé : ${result.voterName} → ${result.targetName}${result.updated ? ' (mis à jour)' : ''}`,
      });
      setSelectedVoter('');
      setSelectedTarget('');
      onVoteForced();
    } catch (err) {
      setForceMessage({ type: 'error', text: err.message });
    }
    setForceLoading(false);
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h2 className="text-lg font-semibold mb-3">Forcer un vote</h2>
      <p className="text-xs text-gray-400 mb-3">
        Si un joueur ne peut pas voter sur son téléphone, vous pouvez forcer son vote ici.
      </p>

      {forceMessage && (
        <div className={`px-3 py-2 rounded-lg text-sm mb-3 ${
          forceMessage.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {forceMessage.text}
          <button onClick={() => setForceMessage(null)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
        </div>
      )}

      <div className="space-y-3">
        {/* Vote Type */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type de vote</label>
          <select
            value={selectedVoteType}
            onChange={(e) => {
              setSelectedVoteType(e.target.value);
              setSelectedVoter('');
              setSelectedTarget('');
            }}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="">-- Choisir le type --</option>
            {voteTypes.map(vt => (
              <option key={vt.value} value={vt.value}>{vt.label}</option>
            ))}
          </select>
        </div>

        {/* Voter */}
        {selectedVoteType && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Joueur (n'a pas encore voté)
              {eligibleVoters.length > 0 && (
                <span className="ml-1 text-gray-500">({eligibleVoters.length} restant{eligibleVoters.length > 1 ? 's' : ''})</span>
              )}
            </label>
            <select
              value={selectedVoter}
              onChange={(e) => {
                setSelectedVoter(e.target.value);
                setSelectedTarget('');
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">-- Choisir le votant --</option>
              {eligibleVoters.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role === 'wolf' ? 'loup' : 'villageois'}{p.status === 'ghost' ? ', fantôme' : ''})
                </option>
              ))}
            </select>
            {eligibleVoters.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Tous les joueurs éligibles ont déjà voté.</p>
            )}
          </div>
        )}

        {/* Target */}
        {selectedVoter && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cible du vote</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">-- Choisir la cible --</option>
              {eligibleTargets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Force button */}
        {selectedVoter && selectedTarget && (
          <button
            onClick={handleForceVote}
            disabled={forceLoading}
            className="w-full py-2 bg-orange-700 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium text-sm"
          >
            {forceLoading ? 'Envoi...' : 'Forcer le vote'}
          </button>
        )}
      </div>
    </div>
  );
}

function VoteSection({ title, results, color }) {
  return (
    <div>
      <h3 className={`text-sm font-medium mb-1 ${color}`}>{title}</h3>
      <div className="space-y-1">
        {results.map((r) => (
          <div key={r.targetId} className="flex items-center gap-2 text-sm">
            <span className="text-white">{r.targetName}</span>
            <div className="flex-1 h-1 bg-gray-800 rounded">
              <div
                className="h-1 bg-gray-500 rounded"
                style={{ width: `${Math.min(100, r.count * 20)}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs w-6 text-right">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NightResultsPanel({ results, currentPhase, players, loading, onReveal }) {
  const victims = [];

  // Wolf victim
  if (results.wolfVictim && !results.wolfVictimProtected) {
    victims.push({ playerId: results.wolfVictim.id, eliminatedBy: 'wolves' });
  }

  // Ghost victim
  if (results.ghostVictim && !results.ghostVictimProtected) {
    victims.push({ playerId: results.ghostVictim.id, eliminatedBy: 'ghosts' });
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h2 className="text-lg font-semibold mb-3">Résolution de la nuit</h2>

      <div className="space-y-2 text-sm">
        {/* Wolf vote result */}
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-medium">Loups :</span>
          {results.wolfVoteTie ? (
            <span className="text-yellow-400">Égalité ! L'admin doit trancher.</span>
          ) : results.wolfVictim ? (
            <span>
              <span className="text-white">{results.wolfVictim.name}</span>
              {results.wolfVictimProtected && (
                <span className="text-green-400 ml-1">(protégé)</span>
              )}
            </span>
          ) : (
            <span className="text-gray-500">Aucun vote</span>
          )}
        </div>

        {/* Ghost vote result */}
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-medium">Fantômes :</span>
          {results.ghostVictim ? (
            <span>
              <span className="text-white">{results.ghostVictim.name}</span>
              {results.ghostVictimProtected && (
                <span className="text-green-400 ml-1">(protégé)</span>
              )}
            </span>
          ) : (
            <span className="text-gray-500">Aucun vote</span>
          )}
        </div>

        {/* Protection info */}
        {results.protectedPlayerId && (
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Protégé :</span>
            <span className="text-white">
              {players.find(p => p.id === results.protectedPlayerId)?.name || `#${results.protectedPlayerId}`}
            </span>
          </div>
        )}

        {/* Ghost identifications */}
        {results.ghostIdentifications?.length > 0 && (
          <div className="mt-3 border-t border-gray-800 pt-3">
            <h3 className="text-green-400 font-medium mb-1">Identifications fantômes :</h3>
            {results.ghostIdentifications.map((gi, i) => (
              <div key={i} className="text-xs text-gray-300">
                {gi.ghost_name} &rarr; {gi.target_name}
                {gi.target_is_wolf ? (
                  <span className="text-green-400 ml-1">(correct)</span>
                ) : (
                  <span className="text-red-400 ml-1">(incorrect)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reveal button */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-2">
          {victims.length > 0
            ? `${victims.length} victime(s) à éliminer`
            : 'Aucune victime cette nuit'}
        </div>
        <button
          onClick={() => onReveal(victims)}
          disabled={!!loading}
          className="px-4 py-2 bg-wolf text-white rounded-lg hover:bg-red-800 disabled:opacity-50 font-medium text-sm"
        >
          Révéler les résultats
        </button>
      </div>
    </div>
  );
}

function CouncilResultsPanel({ results, currentPhase, loading, onReveal }) {
  const victims = [];

  if (results.victim && !results.immune) {
    victims.push({ playerId: results.victim.targetId, eliminatedBy: 'village' });
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h2 className="text-lg font-semibold mb-3">Résolution du conseil</h2>

      <div className="space-y-2 text-sm">
        {/* Vote results */}
        {results.results?.map((r) => (
          <div key={r.targetId} className="flex items-center gap-2">
            <span className="text-white">{r.targetName}</span>
            <span className="text-gray-400">— {r.count} vote(s)</span>
            {r.targetId === results.victim?.targetId && (
              <span className="text-red-400 text-xs font-medium">ÉLIMINÉ</span>
            )}
          </div>
        ))}

        {/* Tie */}
        {results.tie && (
          <div className="text-yellow-400 mt-2">
            Égalité !
            {results.tieBreaker === 'mayor' && " Le maire doit trancher."}
            {results.tieBreaker === 'random' && " Tirage au sort effectué."}
          </div>
        )}

        {/* Immunity */}
        {results.immune && results.immunePlayer && (
          <div className="text-cyan-400 mt-2">
            {results.immunePlayer.targetName} est immunisé ! Aucune élimination.
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <button
          onClick={() => onReveal(victims)}
          disabled={!!loading}
          className="px-4 py-2 bg-wolf text-white rounded-lg hover:bg-red-800 disabled:opacity-50 font-medium text-sm"
        >
          Révéler les résultats
        </button>
      </div>
    </div>
  );
}
