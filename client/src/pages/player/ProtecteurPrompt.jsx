import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';

/**
 * Protector special power prompt.
 * "Choose a player to protect tonight."
 * Cannot protect self or last protected player.
 */
export default function ProtecteurPrompt() {
  const { player, specialPrompt, submitSpecialResponse, setSpecialPrompt } = usePlayer();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const targets = specialPrompt?.targets || [];
  const lastProtectedId = specialPrompt?.lastProtectedId;

  // Filter out self and last protected
  const availableTargets = targets.filter(
    (p) => p.id !== player?.id && p.id !== lastProtectedId
  );

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitSpecialResponse('protecteur', { targetId: selected.id });
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
        <div className="bg-gray-900 border border-cyan-800 rounded-xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-cyan-400 text-lg font-medium mb-2">Protection active</p>
          <p className="text-gray-400 text-sm">
            {selected?.name} est sous votre protection cette nuit.
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
          <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium uppercase tracking-wider mb-2">
            Protecteur
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Choisissez un joueur a proteger cette nuit
          </h2>
          <p className="text-gray-500 text-sm">
            Ce joueur ne pourra pas etre elimine cette nuit
          </p>
        </div>

        {/* Player list */}
        <div className="space-y-2 max-w-md mx-auto">
          {availableTargets.map((p) => (
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
            className="w-full py-4 rounded-xl bg-cyan-700 text-white font-bold text-lg
                       active:bg-cyan-800 transition-colors min-h-[56px] disabled:opacity-50"
          >
            Proteger {selected.name}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selected && (
        <VoteConfirmation
          targetName={selected.name}
          actionLabel="Proteger"
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
