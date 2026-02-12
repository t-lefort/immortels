import { useMemo } from 'react';

/**
 * GameDisplay — Base persistent layer during game.
 * Cinematic full-screen centered layout projected on 16:9 screen.
 * Dramatic title, flowing centered player names, atmospheric effects.
 * Eliminated players shown as a subtle ghostly footer.
 */
export default function GameDisplay({ players, currentPhase, children }) {
  const alivePlayers = players.filter(p => p.status === 'alive');
  const eliminatedPlayers = players.filter(p => p.status === 'ghost');

  // Count phase number from phase ID (approximate)
  const phaseLabel = currentPhase
    ? currentPhase.type === 'night'
      ? 'Nuit'
      : 'Conseil du Village'
    : '';

  const phaseNumber = currentPhase ? currentPhase.id : '';

  // Generate subtle background particles for atmosphere
  const particles = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${2 + Math.random() * 4}s`,
      size: `${1 + Math.random() * 2}px`,
    }));
  }, []);

  // Split alive players into centered columns for a dramatic flowing layout
  // Aim for 3 columns on large counts, 2 on smaller, 1 on very small
  const columnCount = alivePlayers.length > 16 ? 3 : alivePlayers.length > 8 ? 2 : 1;
  const columns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    alivePlayers.forEach((player, i) => {
      cols[i % columnCount].push({ ...player, globalIndex: i });
    });
    return cols;
  }, [alivePlayers, columnCount]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{
      background: 'radial-gradient(ellipse at 50% 30%, rgba(20, 5, 5, 1) 0%, rgba(13, 13, 13, 1) 50%, rgba(5, 5, 10, 1) 100%)',
    }}>

      {/* Atmospheric fog layers */}
      <div className="fog-layer fog-layer-1" />
      <div className="fog-layer fog-layer-2" />
      <div className="fog-layer fog-layer-3" />

      {/* Subtle floating particles */}
      <div className="stars-container" style={{ opacity: 0.4 }}>
        {particles.map(p => (
          <div
            key={p.id}
            className="star"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: 'rgba(139, 0, 0, 0.6)',
              '--twinkle-delay': p.delay,
              '--twinkle-duration': p.duration,
            }}
          />
        ))}
      </div>

      {/* ─── Centered Cinematic Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center relative z-10">

        {/* ─── Title & Phase (centered top) ──────────────────────────── */}
        <div className="flex flex-col items-center pt-[3.5vh]">
          {/* Game title */}
          <h1
            className="font-bold tracking-[0.3em] uppercase animate-pulseGlow"
            style={{
              fontSize: '3vw',
              color: '#fff',
              textShadow: '0 0 20px rgba(139, 0, 0, 0.5), 0 0 50px rgba(139, 0, 0, 0.2)',
            }}
          >
            Les Immortels
          </h1>

          {/* Decorative separator */}
          <div
            className="mt-[1vh] mb-[1vh]"
            style={{
              width: '25vw',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(139, 0, 0, 0.5), transparent)',
            }}
          />

          {/* Phase info */}
          {currentPhase && (
            <div className="text-center animate-fadeIn mb-[0.5vh]">
              <span
                className="font-semibold uppercase tracking-[0.25em]"
                style={{
                  fontSize: '1.3vw',
                  color: currentPhase.type === 'night' ? '#6a7fdb' : '#e0a030',
                  textShadow: currentPhase.type === 'night'
                    ? '0 0 15px rgba(106, 127, 219, 0.4)'
                    : '0 0 15px rgba(224, 160, 48, 0.4)',
                }}
              >
                {phaseLabel}
              </span>
              <span className="text-gray-600 mx-[0.5vw]" style={{ fontSize: '1vw' }}>
                #{phaseNumber}
              </span>
            </div>
          )}

          {/* Alive count — dramatic centered */}
          <div
            className="flex items-center gap-[0.5vw] animate-borderGlow"
            style={{
              padding: '0.3vw 1.2vw',
              borderRadius: '0.4vw',
              border: '1px solid rgba(139, 0, 0, 0.3)',
              background: 'rgba(139, 0, 0, 0.06)',
            }}
          >
            <span
              className="text-white font-bold"
              style={{
                fontSize: '1.8vw',
                textShadow: '0 0 10px rgba(255, 255, 255, 0.15)',
              }}
            >
              {alivePlayers.length}
            </span>
            <span className="text-gray-500" style={{ fontSize: '1vw' }}>
              en vie
            </span>
          </div>
        </div>

        {/* ─── Alive Players: Flowing Centered Names ───────────────── */}
        <div className="flex-1 flex items-center justify-center w-full px-[4vw]">
          <div
            className="flex justify-center gap-[3vw]"
            style={{ maxWidth: '85vw' }}
          >
            {columns.map((col, colIndex) => (
              <div
                key={colIndex}
                className="flex flex-col items-center"
                style={{ gap: '0.8vh' }}
              >
                {col.map((player) => (
                  <div
                    key={player.id}
                    className="text-center"
                    style={{
                      animation: `cardAppear 0.6s ease-out ${player.globalIndex * 50}ms both, cardFloat ${3.5 + (player.globalIndex % 4) * 0.7}s ease-in-out ${(player.globalIndex % 6) * 0.5}s infinite`,
                    }}
                  >
                    <span
                      className="font-semibold inline-block"
                      style={{
                        fontSize: alivePlayers.length > 20 ? '1.5vw' : alivePlayers.length > 12 ? '1.7vw' : '2vw',
                        color: 'rgba(255, 255, 255, 0.9)',
                        textShadow: '0 0 12px rgba(139, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.5)',
                        letterSpacing: '0.06em',
                        padding: '0.2vw 0.8vw',
                        borderBottom: '1px solid rgba(139, 0, 0, 0.12)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {player.name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Eliminated: Subtle Ghost Footer ─────────────────────── */}
        {eliminatedPlayers.length > 0 && (
          <div className="w-full pb-[2vh] px-[4vw]">
            {/* Faded separator */}
            <div
              className="mx-auto mb-[1.2vh]"
              style={{
                width: '40vw',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(45, 106, 79, 0.25), transparent)',
              }}
            />

            {/* Ghost section label */}
            <div className="text-center mb-[0.8vh]">
              <span
                className="uppercase tracking-[0.3em] font-semibold"
                style={{
                  fontSize: '1.2vw',
                  color: 'rgba(45, 106, 79, 0.6)',
                  textShadow: '0 0 8px rgba(45, 106, 79, 0.2)',
                }}
              >
                Cimetiere
              </span>
              <span
                style={{
                  fontSize: '1vw',
                  color: 'rgba(255, 255, 255, 0.2)',
                  marginLeft: '0.4vw',
                }}
              >
                ({eliminatedPlayers.length})
              </span>
            </div>

            {/* Eliminated names — flowing centered line */}
            <div className="flex flex-wrap justify-center gap-x-[2vw] gap-y-[0.8vh]">
              {eliminatedPlayers.map((player, index) => {
                const isWolf = player.role === 'wolf';

                return (
                  <div
                    key={player.id}
                    className="animate-ghostFade flex items-center gap-[0.3vw]"
                    style={{
                      animationDelay: `${index * 60}ms`,
                      animationFillMode: 'both',
                    }}
                  >
                    <span
                      className="font-medium"
                      style={{
                        fontSize: '1.3vw',
                        color: 'rgba(255, 255, 255, 0.35)',
                        textDecoration: 'line-through',
                        textDecorationColor: 'rgba(255, 255, 255, 0.1)',
                        textShadow: '0 0 4px rgba(45, 106, 79, 0.1)',
                      }}
                    >
                      {player.name}
                    </span>
                    {player.role && (
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: '0.9vw',
                          padding: '0.1vw 0.4vw',
                          borderRadius: '0.25vw',
                          background: isWolf
                            ? 'rgba(139, 0, 0, 0.2)'
                            : 'rgba(26, 26, 78, 0.2)',
                          color: isWolf
                            ? 'rgba(255, 68, 68, 0.6)'
                            : 'rgba(106, 127, 219, 0.5)',
                          border: `1px solid ${isWolf
                            ? 'rgba(139, 0, 0, 0.3)'
                            : 'rgba(26, 26, 78, 0.3)'}`,
                        }}
                      >
                        {isWolf ? 'LOUP' : 'VILLAGEOIS'}
                      </span>
                    )}
                    {player.special_role && player.special_role !== 'maire' && (
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: '0.85vw',
                          padding: '0.1vw 0.35vw',
                          borderRadius: '0.25vw',
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: 'rgba(192, 132, 252, 0.5)',
                          border: '1px solid rgba(168, 85, 247, 0.2)',
                        }}
                      >
                        {player.special_role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Overlay children render on top */}
      {children}
    </div>
  );
}
