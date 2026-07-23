import { useState } from 'react';
import PhaseVoteDetails from './PhaseVoteDetails.jsx';
import { rankScoreboard } from '../utils/scoreRanking.js';

/**
 * Read-only view of a finished, archived game: final scoreboard plus the
 * per-phase vote breakdown, mirroring the Phases section of the admin
 * Historique tab.
 *
 * Only rendered once the current game is over, so revealing roles here is
 * safe — the archive payload itself carries no credentials (see
 * server/game-archive.js).
 */
export default function ArchivedGameViewer({ archive }) {
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);

  if (!archive) return null;

  const phases = archive.phases || [];
  const selectedPhase = phases.find(p => p.id === selectedPhaseId) || null;
  const ranked = rankScoreboard(archive.scoreboard || []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h3 className="text-lg font-semibold text-white">{archive.label}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {formatDate(archive.archivedAt)}
          {archive.winner && (
            <span className={archive.winner === 'wolves' ? 'text-red-400 ml-2' : 'text-blue-400 ml-2'}>
              · Victoire des {archive.winner === 'wolves' ? 'Loups' : 'Villageois'}
            </span>
          )}
        </p>
      </div>

      {/* Final scoreboard */}
      {ranked.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Classement final</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-left">
                  <th className="px-2 py-1 w-8">#</th>
                  <th className="px-2 py-1">Joueur</th>
                  <th className="px-2 py-1">Rôle</th>
                  <th className="px-2 py-1 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(p => (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="px-2 py-1 text-gray-500 font-mono">{p.rank}</td>
                    <td className="px-2 py-1 text-white">{p.name}</td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded ${
                        p.role === 'wolf' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {p.role === 'wolf' ? 'Loup' : 'Villageois'}
                      </span>
                      {p.special_role && (
                        <span className="ml-1 text-purple-300">{p.special_role.split(',').join(', ')}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-white font-semibold">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Phases ({phases.length})</h4>

        {phases.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune phase enregistrée</p>
        ) : (
          <div className="space-y-1">
            {phases.map(phase => (
              <button
                key={phase.id}
                onClick={() => setSelectedPhaseId(
                  selectedPhaseId === phase.id ? null : phase.id
                )}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedPhaseId === phase.id
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{phase.type === 'night' ? 'Nuit' : 'Conseil'} #{phase.id}</span>
                <span className="text-xs text-gray-500">
                  {phase.victims?.length > 0
                    ? phase.victims.map(v => v.playerName).join(', ')
                    : 'aucune victime'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPhase && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">
            Détails — {selectedPhase.type === 'night' ? 'Nuit' : 'Conseil'} #{selectedPhase.id}
          </h4>
          <PhaseVoteDetails voteData={selectedPhase} />
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Date inconnue';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR');
}
