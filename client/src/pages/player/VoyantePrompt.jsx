import { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';

/**
 * Seer special power prompt.
 * "Choose a player to see their role."
 * After selection, shows the result: wolf or villager.
 * Shows remaining uses.
 */
export default function VoyantePrompt() {
  const { player, specialPrompt, specialResult, submitSpecialResponse, setSpecialPrompt, setSpecialResult } = usePlayer();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [revealedRole, setRevealedRole] = useState(null);
  const [revealedTarget, setRevealedTarget] = useState(null);

  const targets = specialPrompt?.targets || [];
  const usesRemaining = specialPrompt?.usesRemaining || 0;

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitSpecialResponse('voyante', { targetId: selected.id });
      setRevealedTarget(selected);
      setRevealedRole(res?.target?.role || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  // Also check if the result came via socket
  useEffect(() => {
    if (!revealedRole && specialResult?.power === 'voyante' && specialResult?.target?.role) {
      setRevealedRole(specialResult.target.role);
      setRevealedTarget({ name: specialResult.target.name, id: specialResult.target.id });
      setSpecialResult(null);
    }
  }, [revealedRole, specialResult, setSpecialResult]);

  // Result screen
  if (revealedRole && revealedTarget) {
    const isWolf = revealedRole === 'wolf';
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className={`bg-gray-900 border rounded-xl p-6 max-w-sm w-full text-center ${
          isWolf ? 'border-red-800' : 'border-blue-800'
        }`}>
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-medium uppercase tracking-wider mb-4">
            Voyante
          </div>

          <p className="text-gray-400 text-sm mb-2">Le role de</p>
          <p className="text-white text-xl font-bold mb-4">{revealedTarget.name}</p>

          <div className={`inline-block px-6 py-3 rounded-xl text-2xl font-bold ${
            isWolf
              ? 'bg-red-900/50 text-red-400 border border-red-700'
              : 'bg-blue-900/50 text-blue-400 border border-blue-700'
          }`}>
            {isWolf ? 'LOUP' : 'VILLAGEOIS'}
          </div>

          <p className="text-gray-500 text-xs mt-4">
            {usesRemaining > 1 ? `${usesRemaining - 1} utilisation(s) restante(s)` : 'Derniere utilisation'}
          </p>

          <button
            onClick={() => {
              setSpecialPrompt(null);
              setSpecialResult(null);
            }}
            className="mt-4 px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50 overflow-y-auto">
      <div className="flex-1 px-4 py-6 pb-28">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-medium uppercase tracking-wider mb-2">
            Voyante
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Choisissez un joueur dont vous voulez connaitre le role
          </h2>
          <p className="text-gray-500 text-sm">
            {usesRemaining} utilisation{usesRemaining !== 1 ? 's' : ''} restante{usesRemaining !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Player list */}
        <div className="space-y-2 max-w-md mx-auto">
          {targets.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              selected={selected?.id === p.id}
              onClick={() => setSelected(p)}
              showStatus={false}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-center text-sm mt-4">{error}</p>
        )}
      </div>

      {/* Fixed bottom button */}
      {selected && !confirming && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent">
          <button
            onClick={() => setConfirming(true)}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-indigo-700 text-white font-bold text-lg
                       active:bg-indigo-800 transition-colors min-h-[56px] disabled:opacity-50"
          >
            Voir le role de {selected.name}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selected && (
        <VoteConfirmation
          targetName={selected.name}
          actionLabel="Voir le role de"
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
