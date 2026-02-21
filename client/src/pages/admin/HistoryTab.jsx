import { useState, useEffect } from 'react';
import * as api from '../../services/adminApi.js';

export default function HistoryTab() {
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [voteData, setVoteData] = useState(null);
  const [scoreSnapshots, setScoreSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  useEffect(() => {
    loadPhases();
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

  function selectSnapshot(snapshot) {
    setSelectedSnapshot(snapshot);
  }

  return (
    <div className="space-y-4">
      {/* Score snapshots */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Snapshots de score ({scoreSnapshots.length})</h2>
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
