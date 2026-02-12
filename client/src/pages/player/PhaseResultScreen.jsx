import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Phase result announcement screen.
 * Shows eliminated player name + role reveal.
 * Displayed when a phase:result event is received and cleared when next phase starts.
 */
export default function PhaseResultScreen() {
  const { phaseResult, clearPhaseResult } = usePlayer();

  if (!phaseResult) return null;

  const { phase, eliminated } = phaseResult;
  const phaseLabel = phase?.type === 'night' ? 'la nuit' : 'le conseil du village';
  const hasEliminated = eliminated && eliminated.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Phase type label */}
      <p className="text-gray-500 text-sm uppercase tracking-widest mb-6">
        Résultat de {phaseLabel}
      </p>

      {hasEliminated ? (
        <div className="space-y-6 mb-10 w-full max-w-sm">
          {eliminated.map((p, i) => (
            <div key={p.id || i} className="text-center">
              {/* Eliminated player name */}
              <h2 className="text-3xl font-black text-white mb-2">{p.name}</h2>

              {/* Role reveal */}
              <div
                className={`
                  inline-block px-4 py-2 rounded-full text-lg font-bold
                  ${p.role === 'wolf'
                    ? 'bg-wolf/20 text-wolf border border-wolf/40'
                    : 'bg-villager/20 text-blue-400 border border-blue-800/40'
                  }
                `}
              >
                {p.role === 'wolf' ? 'LOUP' : 'VILLAGEOIS'}
              </div>

              {/* Elimination cause */}
              <p className="text-gray-600 text-sm mt-3">
                {p.eliminatedBy === 'wolves' && 'Dévoré par les loups'}
                {p.eliminatedBy === 'ghosts' && 'Éliminé par les fantômes'}
                {p.eliminatedBy === 'village' && 'Éliminé par le village'}
                {p.eliminatedBy === 'chasseur' && 'Abattu par le chasseur'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Personne n'a été éliminé</h2>
          <p className="text-gray-500">La nuit a été calme...</p>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={clearPhaseResult}
        className="px-8 py-4 rounded-xl bg-gray-800 border border-gray-700 text-white
                   font-bold text-lg active:bg-gray-700 transition-colors min-h-[56px]"
      >
        Continuer
      </button>
    </div>
  );
}
