import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import PlayerCard from '../../components/PlayerCard.jsx';
import VoteConfirmation from '../../components/VoteConfirmation.jsx';
import CountdownTimer from '../../components/CountdownTimer.jsx';

/**
 * Ghost vote during night phase.
 * Vote to eliminate a living player.
 * If ghost is a villager: also show checkboxes to identify suspected wolves.
 * Confirmation dialog before submission.
 */
export default function NightGhostVote() {
  const {
    player, players, vote, ghostIdentify, hasVoted,
    voteCount, totalExpected, timerDuration, setTimerDuration,
  } = usePlayer();

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Ghost identification state (villager ghosts only)
  const [suspectedWolves, setSuspectedWolves] = useState(new Set());
  const [identSubmitted, setIdentSubmitted] = useState(false);

  const alreadyVoted = hasVoted.ghost_eliminate;
  const alreadyIdentified = hasVoted.ghost_identify;
  const isVillagerGhost = player?.role === 'villager';

  // Alive players to vote against
  const alivePlayers = players.filter((p) => p.status === 'alive');

  function toggleSuspect(playerId) {
    setSuspectedWolves((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  async function handleVoteConfirm() {
    if (!selectedTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      await vote(selectedTarget.id);
      setConfirming(false);
      setSelectedTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIdentifySubmit() {
    if (suspectedWolves.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await ghostIdentify([...suspectedWolves]);
      setIdentSubmitted(true);
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

      {/* ─── Ghost Elimination Vote ─────────────────────────────────────── */}
      {alreadyVoted ? (
        <div className="text-center mb-8">
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
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {alivePlayers.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                selected={selectedTarget?.id === p.id}
                onClick={() => setSelectedTarget(p)}
                showStatus={false}
              />
            ))}
          </div>
        </>
      )}

      {/* ─── Wolf Identification (villager ghosts only) ─────────────────── */}
      {isVillagerGhost && (
        <div className="mt-6">
          <div className="border-t border-gray-800 pt-6 mb-4">
            <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-1">
              Identification des loups
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Sélectionnez les joueurs que vous soupçonnez d'être des loups
              (+1 si correct, -1 si incorrect)
            </p>
          </div>

          {alreadyIdentified || identSubmitted ? (
            <div className="text-center mb-4">
              <p className="text-gray-400 text-sm">Identifications envoyées</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {alivePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleSuspect(p.id)}
                    className={`
                      w-full text-left rounded-lg border p-3 min-h-[48px] transition-all
                      ${suspectedWolves.has(p.id)
                        ? 'border-yellow-600 bg-yellow-900/20'
                        : 'border-gray-700 bg-gray-800/50 active:bg-gray-700/70'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{p.name}</span>
                      {suspectedWolves.has(p.id) && (
                        <span className="text-yellow-500 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-900/30">
                          Suspect
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {suspectedWolves.size > 0 && (
                <button
                  onClick={handleIdentifySubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gray-600 text-white font-bold text-base
                             active:bg-gray-700 transition-colors min-h-[48px]
                             disabled:opacity-50 mb-4"
                >
                  {submitting ? 'Envoi...' : `Identifier ${suspectedWolves.size} joueur${suspectedWolves.size > 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-center text-sm mb-4">{error}</p>
      )}

      {/* Fixed bottom vote button */}
      {!alreadyVoted && selectedTarget && !confirming && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-4 rounded-xl bg-gray-600 text-white font-bold text-lg
                       active:bg-gray-700 transition-colors min-h-[56px]"
          >
            Voter pour {selectedTarget.name}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && selectedTarget && (
        <VoteConfirmation
          targetName={selectedTarget.name}
          actionLabel="Voter pour"
          onConfirm={handleVoteConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
