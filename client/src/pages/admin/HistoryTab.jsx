import { useState, useEffect } from 'react';
import * as api from '../../services/adminApi.js';

export default function HistoryTab() {
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [voteData, setVoteData] = useState(null);
  const [scoreEvents, setScoreEvents] = useState([]);
  const [scoreSnapshots, setScoreSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingScoreEvents, setLoadingScoreEvents] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  useEffect(() => {
    loadPhases();
    loadScoreEvents();
    loadScoreSnapshots();
  }, []);

  async function loadPhases() {
    try {
      const data = await api.getPhases();
      setPhases(data);
    } catch { /* ignore */ }
  }

  async function selectPhase(phase) {
    setSelectedPhase(phase);
    setLoading(true);
    try {
      const data = await api.getPhaseVotes(phase.id);
      setVoteData(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadScoreSnapshots() {
    setLoadingSnapshots(true);
    try {
      const data = await api.getScoreSnapshots(200);
      setScoreSnapshots(Array.isArray(data) ? data : []);
    } catch {
      setScoreSnapshots([]);
    }
    setLoadingSnapshots(false);
  }

  async function loadScoreEvents() {
    setLoadingScoreEvents(true);
    try {
      const data = await api.getScoreEvents(500);
      setScoreEvents(Array.isArray(data) ? data : []);
    } catch {
      setScoreEvents([]);
    }
    setLoadingScoreEvents(false);
  }

  function selectSnapshot(snapshot) {
    setSelectedSnapshot(snapshot);
  }

  return (
    <div className="space-y-4">
      {/* Human-readable score event log */}
      <div className="bg-gray-900 rounded-lg p-4 border border-cyan-900/40">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">Journal des points ({scoreEvents.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Chaque ligne explique un gain, une perte ou une annulation, avec le score avant et après.
            </p>
          </div>
          <button
            onClick={loadScoreEvents}
            className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 border border-gray-700"
          >
            Rafraîchir
          </button>
        </div>

        {loadingScoreEvents ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : scoreEvents.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun mouvement de score enregistré</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto border border-gray-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="px-3 py-2 whitespace-nowrap">Moment</th>
                  <th className="px-3 py-2 whitespace-nowrap">Étape</th>
                  <th className="px-3 py-2">Joueur</th>
                  <th className="px-3 py-2">Explication</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Variation</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Score</th>
                </tr>
              </thead>
              <tbody>
                {scoreEvents.map(event => (
                  <tr key={event.id} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {formatScoreEventTime(event.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                      {scoreEventSourceLabel(event)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{event.playerName}</div>
                      <div className="text-[10px] text-gray-600">
                        {event.playerRole === 'wolf' ? 'Loup' : 'Villageois'} · {event.playerStatus === 'alive' ? 'vivant' : 'fantôme'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      <div>{scoreEventReasonLabel(event)}</div>
                      {scoreEventDetail(event) && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{scoreEventDetail(event)}</div>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold text-sm ${event.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span className="text-gray-500">{event.scoreBefore}</span>
                      <span className="text-gray-600 mx-1">→</span>
                      <span className="text-white font-semibold">{event.scoreAfter}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score snapshots */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Sauvegardes techniques ({scoreSnapshots.length})</h2>
            <p className="text-xs text-gray-600">État complet avant une modification, utile pour la récupération.</p>
          </div>
          <button
            onClick={loadScoreSnapshots}
            className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 border border-gray-700"
          >
            Rafraîchir
          </button>
        </div>

        {loadingSnapshots ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : scoreSnapshots.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun snapshot</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {scoreSnapshots.map((snapshot) => (
              <button
                key={snapshot.id}
                onClick={() => selectSnapshot(snapshot)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSnapshot?.id === snapshot.id
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{snapshotReasonLabel(snapshot.reason)}</span>
                  <span className="text-xs text-gray-500">#{snapshot.id}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatSnapshotTime(snapshot.createdAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSnapshot && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-1">
            Détail snapshot #{selectedSnapshot.id}
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            {formatSnapshotTime(selectedSnapshot.createdAt)} • {snapshotReasonLabel(selectedSnapshot.reason)}
          </p>

          {selectedSnapshot.context && Object.keys(selectedSnapshot.context).length > 0 && (
            <div className="mb-3 text-xs text-gray-400 bg-gray-800/50 border border-gray-700 rounded p-2 overflow-x-auto">
              <code>{JSON.stringify(selectedSnapshot.context)}</code>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Rôle</th>
                  <th className="px-2 py-1">Statut</th>
                  <th className="px-2 py-1 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSnapshot.scores || []).map((p, i) => (
                  <tr key={`${selectedSnapshot.id}-${p.id}-${i}`} className="border-b border-gray-800/50">
                    <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-1 text-white">{p.name}</td>
                    <td className="px-2 py-1 text-gray-400">
                      {p.role || '—'}{p.special_role ? ` (${p.special_role})` : ''}
                    </td>
                    <td className="px-2 py-1 text-gray-400">{p.status || '—'}</td>
                    <td className="px-2 py-1 text-right text-white font-medium">{p.score ?? 0}</td>
                  </tr>
                ))}
                {(selectedSnapshot.scores || []).length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-2 py-3 text-center text-gray-500">
                      Aucun score enregistré
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phase List */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Phases ({phases.length})</h2>

        {phases.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune phase</p>
        ) : (
          <div className="space-y-1">
            {phases.map(phase => (
              <button
                key={phase.id}
                onClick={() => selectPhase(phase)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedPhase?.id === phase.id
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>
                  {phase.type === 'night' ? 'Nuit' : 'Conseil'} #{phase.id}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  phase.status === 'completed' ? 'bg-blue-900/50 text-blue-300' :
                  phase.status === 'voting' ? 'bg-yellow-900/50 text-yellow-300' :
                  phase.status === 'active' ? 'bg-green-900/50 text-green-300' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {phase.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vote Details */}
      {selectedPhase && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3">
            Détails — {selectedPhase.type === 'night' ? 'Nuit' : 'Conseil'} #{selectedPhase.id}
          </h2>

          {loading ? (
            <p className="text-gray-500 text-sm">Chargement...</p>
          ) : voteData ? (
            <div className="space-y-4">
              {/* Tallies */}
              {voteData.wolfResults?.length > 0 && (
                <TallySection title="Votes loups" results={voteData.wolfResults} color="text-red-400" />
              )}
              {voteData.villagerGuessResults?.length > 0 && (
                <TallySection title="Devinettes villageois" results={voteData.villagerGuessResults} color="text-blue-400" />
              )}
              {voteData.ghostResults?.length > 0 && (
                <TallySection title="Votes fantômes" results={voteData.ghostResults} color="text-green-400" />
              )}
              {voteData.villageResults?.length > 0 && (
                <TallySection title="Votes du conseil" results={voteData.villageResults} color="text-yellow-400" />
              )}

              {/* Ghost identifications (villager ghosts guessing wolves) */}
              {voteData.ghostIdentifications?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-1 text-purple-400">Identifications fantômes</h3>
                  <div className="space-y-1">
                    {voteData.ghostIdentifications.map((gi, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                        <span className="text-purple-300">{gi.ghost_name}</span>
                        <span className="text-gray-600">&rarr;</span>
                        <span className="text-white">{gi.target_name}</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          gi.target_is_wolf
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-red-900/50 text-red-300'
                        }`}>
                          {gi.target_is_wolf ? 'Correct' : 'Faux'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual votes */}
              {voteData.details?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Votes individuels ({voteData.details.length})
                  </h3>
                  <div className="space-y-1">
                    {voteData.details.map(v => (
                      <div key={v.id} className="flex items-center gap-2 text-xs text-gray-300">
                        <span className={`px-1.5 py-0.5 rounded ${
                          v.vote_type === 'wolf' ? 'bg-red-900/50 text-red-300' :
                          v.vote_type === 'village' ? 'bg-yellow-900/50 text-yellow-300' :
                          v.vote_type === 'villager_guess' ? 'bg-blue-900/50 text-blue-300' :
                          'bg-green-900/50 text-green-300'
                        }`}>
                          {v.vote_type}
                        </span>
                        <span>
                          {v.voter_name}
                          <span className="text-gray-600 ml-1">
                            ({v.voter_role === 'wolf' ? 'L' : 'V'})
                          </span>
                        </span>
                        <span className="text-gray-600">&rarr;</span>
                        <span>
                          {v.target_name || '(abstention)'}
                          {v.target_role && (
                            <span className="text-gray-600 ml-1">
                              ({v.target_role === 'wolf' ? 'L' : 'V'})
                            </span>
                          )}
                        </span>
                        {!v.is_valid && <span className="text-red-400">(invalide)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {voteData.details?.length === 0 && (
                <p className="text-gray-500 text-sm">Aucun vote enregistré</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Aucune donnée</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatSnapshotTime(value) {
  if (!value) return 'Date inconnue';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR');
}

function formatScoreEventTime(value) {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function scoreEventSourceLabel(event) {
  if (event.sourceType === 'phase_undo') return `Annulation phase #${event.phaseId || event.sourceId}`;
  if (event.sourceType === 'phase') {
    const type = event.metadata?.phaseType === 'night' ? 'Nuit' : 'Conseil';
    return `${type} #${event.phaseId || event.sourceId}`;
  }
  if (event.sourceType === 'hunter') return event.phaseId ? `Chasseur · phase #${event.phaseId}` : 'Chasseur';
  if (event.sourceType === 'challenge') return event.metadata?.challengeName || `Épreuve #${event.sourceId}`;
  if (event.sourceType === 'game_end') return 'Fin de partie';
  if (event.sourceType === 'admin') return 'Correction admin';
  return event.sourceType || 'Score';
}

function scoreEventReasonLabel(event) {
  const labels = {
    villager_guess_correct: 'Bonne devinette : villageois identifié',
    ghost_identified_wolf: 'Fantôme : loup correctement identifié',
    ghost_identified_wrong: 'Fantôme : mauvaise identification',
    ghost_wolf_eliminated_villager: 'Fantôme loup : villageois éliminé',
    villager_voted_wolf: 'Vote du conseil contre un loup',
    wolf_survived_council: 'Loup survivant au conseil',
    challenge_winner: 'Membre de l’équipe gagnante',
    winning_faction: 'Victoire de la faction',
    winning_faction_survivor: 'Victoire de la faction + bonus de survie',
    hunter_killed_wolf: 'Chasseur : loup éliminé',
    hunter_killed_villager: 'Chasseur : villageois éliminé',
    admin_score_override: 'Score corrigé manuellement',
    phase_score_reverted: 'Points de la phase annulés',
  };

  if (event.reason === 'phase_score_reverted' && event.metadata?.originalReason) {
    return `Annulation : ${labels[event.metadata.originalReason] || event.metadata.originalReason}`;
  }
  return labels[event.reason] || event.reason || 'Mouvement de score';
}

function scoreEventDetail(event) {
  if (event.metadata?.targetName) return `Cible : ${event.metadata.targetName}`;
  if (event.sourceType === 'game_end') {
    return event.metadata?.winner === 'wolves' ? 'Victoire des Loups' : 'Victoire des Villageois';
  }
  if (event.reason === 'admin_score_override') {
    return `Correction de ${event.metadata?.previousScore} à ${event.metadata?.newScore}`;
  }
  return '';
}

function snapshotReasonLabel(reason) {
  const labels = {
    phase_scores: 'Scores de phase',
    challenge_scores: 'Scores d’épreuve',
    final_scores: 'Scores fin de partie',
    admin_score_override: 'Modification manuelle admin',
    phase_undo_scores: 'Annulation de phase',
    hunter_score: 'Score chasseur',
  };
  return labels[reason] || reason || 'Snapshot';
}

function TallySection({ title, results, color }) {
  return (
    <div>
      <h3 className={`text-sm font-medium mb-1 ${color}`}>{title}</h3>
      <div className="space-y-1">
        {results.map(r => (
          <div key={r.targetId} className="flex items-center gap-2 text-sm">
            <span className="text-white w-28 truncate">{r.targetName}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded">
              <div
                className="h-1.5 bg-gray-500 rounded"
                style={{ width: `${Math.min(100, r.count * 15)}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs w-6 text-right">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
