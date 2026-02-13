import { useState, useEffect, useMemo } from 'react';

/**
 * VoteRevealDisplay — Post-council vote reveal overlay for the dashboard.
 * Shows who voted for whom, grouped by target, with the eliminated player highlighted.
 * Displayed after the dramatic result reveal, dismissed by the admin.
 */
export default function VoteRevealDisplay({ councilVotes, eliminatedPlayer }) {
  const [revealed, setRevealed] = useState(false);

  // Staggered reveal animation
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Group votes by target, sorted by vote count descending
  const groupedVotes = useMemo(() => {
    if (!councilVotes || councilVotes.length === 0) return [];

    const groups = {};
    for (const vote of councilVotes) {
      const key = vote.targetId;
      if (!groups[key]) {
        groups[key] = {
          targetId: vote.targetId,
          targetName: vote.targetName,
          voters: [],
        };
      }
      groups[key].voters.push(vote.voterName);
    }

    return Object.values(groups).sort((a, b) => b.voters.length - a.voters.length);
  }, [councilVotes]);

  const eliminatedId = eliminatedPlayer?.id;
  const totalVotes = councilVotes?.length || 0;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fadeIn"
      style={{
        background:
          'radial-gradient(ellipse at center, rgb(20, 15, 5) 0%, rgb(10, 8, 2) 50%, rgb(5, 5, 5) 100%)',
      }}
    >
      {/* Title */}
      <div
        className="animate-slideUp"
        style={{
          animationDelay: '0.1s',
          animationFillMode: 'both',
        }}
      >
        <h1
          className="font-bold uppercase tracking-[0.3em] text-center"
          style={{
            fontSize: '2.2vw',
            color: 'rgba(224, 160, 48, 0.9)',
            textShadow: '0 0 20px rgba(224, 160, 48, 0.3)',
          }}
        >
          Votes du Conseil
        </h1>
      </div>

      {/* Decorative line */}
      <div
        className="animate-slideUp"
        style={{
          width: '40vw',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(224, 160, 48, 0.5), transparent)',
          marginTop: '2vh',
          marginBottom: '3vh',
          animationDelay: '0.3s',
          animationFillMode: 'both',
        }}
      />

      {/* Vote groups */}
      <div
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          maxWidth: '85vw',
          width: '100%',
          maxHeight: '65vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2.5vh',
          paddingBottom: '2vh',
        }}
      >
        {groupedVotes.map((group, groupIndex) => {
          const isEliminated = group.targetId === eliminatedId;
          const votePercentage = totalVotes > 0 ? Math.round((group.voters.length / totalVotes) * 100) : 0;

          return (
            <div
              key={group.targetId}
              style={{
                width: '70vw',
                maxWidth: '900px',
                padding: '1.5vh 2vw',
                borderRadius: '0.6vw',
                background: isEliminated
                  ? 'rgba(139, 0, 0, 0.2)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isEliminated
                  ? '1px solid rgba(139, 0, 0, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                animation: 'slideUp 0.5s ease-out forwards',
                animationDelay: `${0.4 + groupIndex * 0.15}s`,
                animationFillMode: 'both',
                opacity: 0,
              }}
            >
              {/* Target name + vote count */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1vh',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '2vw',
                      color: isEliminated ? '#ff4444' : '#fff',
                      textShadow: isEliminated
                        ? '0 0 15px rgba(255, 68, 68, 0.4)'
                        : 'none',
                    }}
                  >
                    {group.targetName}
                  </span>
                  {isEliminated && (
                    <span
                      className="uppercase font-bold tracking-wider"
                      style={{
                        fontSize: '0.9vw',
                        color: '#ff4444',
                        padding: '0.2vh 0.6vw',
                        borderRadius: '0.3vw',
                        background: 'rgba(139, 0, 0, 0.3)',
                        border: '1px solid rgba(139, 0, 0, 0.5)',
                      }}
                    >
                      {'\u00C9'}limin{'\u00E9'}(e)
                    </span>
                  )}
                </div>
                <span
                  className="font-bold"
                  style={{
                    fontSize: '1.6vw',
                    color: isEliminated
                      ? 'rgba(255, 68, 68, 0.8)'
                      : 'rgba(224, 160, 48, 0.8)',
                  }}
                >
                  {group.voters.length} vote{group.voters.length > 1 ? 's' : ''}{' '}
                  <span
                    style={{
                      fontSize: '1.1vw',
                      color: 'rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    ({votePercentage}%)
                  </span>
                </span>
              </div>

              {/* Vote bar */}
              <div
                style={{
                  width: '100%',
                  height: '0.4vh',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '2px',
                  marginBottom: '1vh',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${votePercentage}%`,
                    height: '100%',
                    background: isEliminated
                      ? 'rgba(139, 0, 0, 0.7)'
                      : 'rgba(224, 160, 48, 0.5)',
                    borderRadius: '2px',
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>

              {/* Voter names */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5vw',
                }}
              >
                {group.voters.map((voterName, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '1.1vw',
                      color: 'rgba(255, 255, 255, 0.5)',
                      padding: '0.2vh 0.5vw',
                      borderRadius: '0.2vw',
                      background: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    {voterName}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom subtle indicator */}
      <div
        className="absolute bottom-[2vh] text-center"
        style={{
          opacity: revealed ? 0.4 : 0,
          transition: 'opacity 1s ease-out 1.5s',
        }}
      >
        <span style={{ fontSize: '0.9vw', color: 'rgba(255, 255, 255, 0.4)' }}>
          En attente de l'admin...
        </span>
      </div>

      {/* Subtle border glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          border: '1px solid rgba(224, 160, 48, 0.05)',
          boxShadow:
            'inset 0 0 80px rgba(224, 160, 48, 0.03), inset 0 0 200px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}
