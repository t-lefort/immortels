/**
 * Vote breakdown of a single phase.
 *
 * Shared by the admin Historique tab and the player-facing review of past
 * games so both show the same thing. Consumes either the live
 * GET /api/admin/phase/votes payload or an archived phase — the two have the
 * same shape by design (see buildArchiveView in server/game-archive.js).
 */
export default function PhaseVoteDetails({ voteData, showRoles = true }) {
  if (!voteData) {
    return <p className="text-gray-500 text-sm">Aucune donnée</p>;
  }

  const hasAnything =
    voteData.wolfResults?.length ||
    voteData.villagerGuessResults?.length ||
    voteData.ghostResults?.length ||
    voteData.villageResults?.length ||
    voteData.details?.length;

  if (!hasAnything) {
    return <p className="text-gray-500 text-sm">Aucun vote enregistré</p>;
  }

  return (
    <div className="space-y-4">
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

      {voteData.victims?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-1 text-orange-400">Éliminations</h3>
          <div className="space-y-1">
            {voteData.victims.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                <span className="text-white">{v.playerName}</span>
                {showRoles && v.role && (
                  <span className="text-gray-600">({v.role === 'wolf' ? 'Loup' : 'Villageois'})</span>
                )}
                <span className="text-gray-600">— {eliminatedByLabel(v.eliminatedBy)}</span>
                {v.wasResurrected ? <span className="text-cyan-400">(ressuscité)</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {voteData.details?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Votes individuels ({voteData.details.length})
          </h3>
          <div className="space-y-1">
            {voteData.details.map(v => (
              <div key={v.id} className="flex items-center gap-2 text-xs text-gray-300 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded ${
                  v.vote_type === 'wolf' ? 'bg-red-900/50 text-red-300' :
                  v.vote_type === 'village' ? 'bg-yellow-900/50 text-yellow-300' :
                  v.vote_type === 'villager_guess' ? 'bg-blue-900/50 text-blue-300' :
                  'bg-green-900/50 text-green-300'
                }`}>
                  {voteTypeLabel(v.vote_type)}
                </span>
                <span>
                  {v.voter_name}
                  {showRoles && v.voter_role && (
                    <span className="text-gray-600 ml-1">({v.voter_role === 'wolf' ? 'L' : 'V'})</span>
                  )}
                </span>
                <span className="text-gray-600">&rarr;</span>
                <span>
                  {v.target_name || '(abstention)'}
                  {showRoles && v.target_role && (
                    <span className="text-gray-600 ml-1">({v.target_role === 'wolf' ? 'L' : 'V'})</span>
                  )}
                </span>
                {!v.is_valid && <span className="text-gray-500">(non comptabilisé)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function voteTypeLabel(type) {
  const labels = {
    wolf: 'loup',
    village: 'conseil',
    villager_guess: 'devinette',
    ghost_eliminate: 'fantôme',
  };
  return labels[type] || type;
}

function eliminatedByLabel(by) {
  const labels = {
    wolves: 'par les loups',
    ghosts: 'par les fantômes',
    village: 'par le conseil',
    chasseur: 'par le chasseur',
  };
  return labels[by] || by || '—';
}

export function TallySection({ title, results, color }) {
  const max = Math.max(1, ...results.map(r => r.count));

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
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs w-6 text-right">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
