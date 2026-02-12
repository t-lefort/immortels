import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';

/**
 * Mayor succession prompt.
 * "You are eliminated. Choose your successor as Mayor."
 * Shown when the current mayor is eliminated.
 */
export default function MayorSuccessionPrompt() {
  const { specialPrompt, submitSpecialResponse, setSpecialPrompt } = usePlayer();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const targets = specialPrompt?.targets || [];

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitSpecialResponse('mayor_succession', { targetId: selected.id });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-yellow-800 rounded-xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-yellow-400 text-lg font-medium mb-2">Successeur designe</p>
          <p className="text-gray-400 text-sm">
            {selected?.name} est le nouveau Maire du village.
          </p>
          <button
            onClick={() => setSpecialPrompt(null)}
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
          <div className="inline-block px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium uppercase tracking-wider mb-2">
            Maire
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Vous etes elimine
          </h2>
          <p className="text-gray-400 text-base">
            Choisissez votre successeur comme Maire
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
            className="w-full py-4 rounded-xl bg-yellow-700 text-white font-bold text-lg
                       active:bg-yellow-800 transition-colors min-h-[56px] disabled:opacity-50"
          >
            Nommer {selected.name} Maire
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selected && (
        <VoteConfirmation
          targetName={selected.name}
          actionLabel="Nommer Maire"
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
