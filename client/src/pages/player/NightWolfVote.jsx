import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';
import NightVoteInfoPanel from '../../components/NightVoteInfoPanel.jsx';

/**
 * Wolf vote during night phase.
 * List of alive villagers (not wolves) to vote for.
 * Selection + confirmation dialog. Shows shared vote counter X/Y.
 */
export default function NightWolfVote() {
  const {
    players, wolves, vote, hasVoted,
    voteCount, totalExpected,
  } = usePlayer();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const alreadyVoted = hasVoted.wolf;
  const wolfIds = new Set(wolves.map((w) => w.id));

  // Wolves vote for alive non-wolf players
  const votableTargets = players.filter(
    (p) => p.status === 'alive' && !wolfIds.has(p.id)
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
        <div className="inline-block px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">
          Nuit - Vote
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Choisissez un joueur
        </h2>
        <p className="text-gray-500 text-sm">
          Sélectionnez un joueur pour voter
        </p>
      </div>

      {/* Vote counter */}
      <div className="flex justify-center mb-4">
        <div className="bg-gray-800/70 border border-gray-700 rounded-full px-5 py-2">
          <span className="text-white font-bold text-lg">{voteCount}</span>
          <span className="text-gray-500 mx-1">/</span>
          <span className="text-gray-400 text-lg">{totalExpected}</span>
          <span className="text-gray-600 text-sm ml-2">votes</span>
        </div>
      </div>

      {/* Night vote info panel */}
      <NightVoteInfoPanel />

      {/* Already voted state */}
      {alreadyVoted ? (
        <div className="text-center mt-12">
          <div className="w-16 h-16 rounded-full bg-gray-700/30 border-2 border-gray-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-gray-400 text-lg">Vote enregistré</p>
          <p className="text-gray-600 text-sm mt-2">
            En attente des autres joueurs...
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
            <p className="text-red-400 text-center text-sm mb-4">{error}</p>
          )}

        </>
      )}

      {/* Fixed bottom vote button */}
      {!alreadyVoted && selected && !confirming && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-4 rounded-xl bg-gray-600 text-white font-bold text-lg
                       active:bg-gray-700 transition-colors min-h-[56px]"
          >
            Voter pour {selected.name}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selected && (
        <VoteConfirmation
          targetName={selected.name}
          actionLabel="Voter pour"
          onConfirm={handleConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
