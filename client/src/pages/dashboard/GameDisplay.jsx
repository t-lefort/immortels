/**
 * GameDisplay — Base persistent layer during game.
 * Left area (60%): Grid of alive players with name cards
 * Right area (40%): List of eliminated players with revealed roles
 * Top bar: Game title, current phase type/number, alive count
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

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: '#0d0d0d' }}>

      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-[2vw] shrink-0"
        style={{
          height: '8vh',
          background: 'linear-gradient(180deg, rgba(13,13,13,1) 0%, rgba(13,13,13,0.95) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Title */}
        <h1
          className="font-bold tracking-[0.15em] uppercase"
          style={{
            fontSize: '2vw',
            color: '#fff',
            textShadow: '0 0 10px rgba(139,0,0,0.3)',
          }}
        >
          Les Immortels
        </h1>

        {/* Phase info */}
        {currentPhase && (
          <div className="text-center">
            <span
              className="font-semibold"
              style={{
                fontSize: '1.5vw',
                color: currentPhase.type === 'night' ? '#6a7fdb' : '#e0a030',
              }}
            >
              {phaseLabel}
            </span>
            <span className="text-gray-500 mx-[0.5vw]" style={{ fontSize: '1.2vw' }}>
              #{phaseNumber}
            </span>
          </div>
        )}

        {/* Alive count */}
        <div className="text-right">
          <span className="text-white font-bold" style={{ fontSize: '2vw' }}>
            {alivePlayers.length}
          </span>
          <span className="text-gray-400 ml-[0.5vw]" style={{ fontSize: '1.2vw' }}>
            en vie
          </span>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left area (60%): Alive players grid */}
        <div
          className="flex flex-col p-[1.5vw]"
          style={{ width: '62%' }}
        >
          <h2
            className="text-gray-400 font-semibold uppercase tracking-wider mb-[1vh]"
            style={{ fontSize: '1.2vw' }}
          >
            Joueurs en vie
          </h2>

          <div
            className="flex-1 grid gap-[0.5vw] content-start"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(10vw, 1fr))',
              gridAutoRows: 'min-content',
            }}
          >
            {alivePlayers.map((player, index) => (
              <div
                key={player.id}
                className="animate-fadeIn flex items-center justify-center text-center"
                style={{
                  animationDelay: `${index * 30}ms`,
                  animationFillMode: 'both',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.4vw',
                  padding: '0.6vw 0.8vw',
                }}
              >
                <span
                  className="text-white font-medium truncate"
                  style={{ fontSize: '1.3vw' }}
                >
                  {player.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div
          className="shrink-0"
          style={{
            width: '1px',
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)',
          }}
        />

        {/* Right area (40%): Eliminated players */}
        <div
          className="flex flex-col p-[1.5vw]"
          style={{ width: '38%' }}
        >
          <h2
            className="text-gray-400 font-semibold uppercase tracking-wider mb-[1vh]"
            style={{ fontSize: '1.2vw' }}
          >
            Éliminés ({eliminatedPlayers.length})
          </h2>

          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col gap-[0.4vw]">
              {eliminatedPlayers.length === 0 ? (
                <p className="text-gray-600 italic" style={{ fontSize: '1.1vw' }}>
                  Aucun joueur éliminé
                </p>
              ) : (
                eliminatedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between animate-slideInRight"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '0.3vw',
                      padding: '0.5vw 0.8vw',
                    }}
                  >
                    <span
                      className="text-gray-400 font-medium truncate"
                      style={{ fontSize: '1.2vw' }}
                    >
                      {player.name}
                    </span>

                    {/* Role badge */}
                    {player.role && (
                      <div className="flex items-center gap-[0.3vw] shrink-0 ml-[0.5vw]">
                        <span
                          className="font-bold uppercase"
                          style={{
                            fontSize: '0.9vw',
                            padding: '0.2vw 0.6vw',
                            borderRadius: '0.3vw',
                            background: player.role === 'wolf'
                              ? 'rgba(139, 0, 0, 0.3)'
                              : 'rgba(26, 26, 78, 0.3)',
                            color: player.role === 'wolf'
                              ? '#ff4444'
                              : '#6a7fdb',
                            border: `1px solid ${player.role === 'wolf'
                              ? 'rgba(139, 0, 0, 0.5)'
                              : 'rgba(26, 26, 78, 0.5)'}`,
                          }}
                        >
                          {player.role === 'wolf' ? 'LOUP' : 'VILLAGEOIS'}
                        </span>
                        {player.special_role && player.special_role !== 'maire' && (
                          <span
                            className="font-bold uppercase"
                            style={{
                              fontSize: '0.8vw',
                              padding: '0.2vw 0.5vw',
                              borderRadius: '0.3vw',
                              background: 'rgba(168, 85, 247, 0.25)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.4)',
                            }}
                          >
                            {player.special_role}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay children render on top */}
      {children}
    </div>
  );
}
