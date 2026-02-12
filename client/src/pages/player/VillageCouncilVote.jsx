import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';
import CountdownTimer from '../../components/CountdownTimer.jsx';

/**
 * Village council vote screen.
 * List of alive players (excluding self) to vote against.
 * Shows immunity indicator if applicable.
 * Selection + confirmation dialog.
 */
export default function VillageCouncilVote() {
  const {
    player, players, vote, hasVoted,
    voteCount, totalExpected, timerDuration, setTimerDuration,
  } = usePlayer();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const alreadyVoted = hasVoted.village;

  // Alive players excluding self
  const votableTargets = players.filter(
    (p) => p.status === 'alive' && p.id !== player?.id
  );

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await vote(selected.id);
      setConfirming(false);
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-28">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-block px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-500 text-xs font-medium uppercase tracking-wider mb-2">
          Conseil du Village
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Qui doit être éliminé ?
        </h2>
        <p className="text-gray-500 text-sm">
          Votez pour éliminer un joueur suspect
        </p>
      </div>

      {/* Timer */}
      {timerDuration && (
        <div className="mb-4 bg-gray-800/50 border border-gray-700 rounded-xl p-3">
          <CountdownTimer
            duration={timerDuration}
            onComplete={() => setTimerDuration(null)}
          />
        </div>
      )}

      {/* Vote counter */}
      <div className="flex justify-center mb-4">
        <div className="bg-gray-800/70 border border-gray-700 rounded-full px-5 py-2">
          <span className="text-white font-bold text-lg">{voteCount}</span>
          <span className="text-gray-500 mx-1">/</span>
          <span className="text-gray-400 text-lg">{totalExpected}</span>
          <span className="text-gray-600 text-sm ml-2">votes</span>
        </div>
      </div>

      {/* Already voted state */}
      {alreadyVoted ? (
        <div className="text-center mt-12">
          <div className="w-16 h-16 rounded-full bg-yellow-900/20 border-2 border-yellow-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-gray-400 text-lg">Vote enregistré</p>
          <p className="text-gray-600 text-sm mt-2">
            En attente du résultat du conseil...
          </p>
        </div>
      ) : (
        <>
          {/* Player list */}
          <div className="space-y-2 mb-4">
            {votableTargets.map((p) => (
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
            <p className="text-wolf text-center text-sm mb-4">{error}</p>
          )}
        </>
      )}

      {/* Fixed bottom vote button */}
      {!alreadyVoted && selected && !confirming && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-4 rounded-xl bg-yellow-700 text-white font-bold text-lg
                       active:bg-yellow-800 transition-colors min-h-[56px]"
          >
            Voter contre {selected.name}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selected && (
        <VoteConfirmation
          targetName={selected.name}
          actionLabel="Voter contre"
          onConfirm={handleConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
