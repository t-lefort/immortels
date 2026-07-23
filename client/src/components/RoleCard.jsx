/**
 * The role card, shown only while a finger is held down.
 *
 * The markup is identical whether the role displayed is the real one or a
 * faked Villageois — see RoleRevealScreen for why that matters. A capture
 * taken while the card is up carries nothing that could tell the two apart.
 */
export function RoleCard({ isWolf, playerName, pack = [], onRelease }) {
  return (
    <div
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      // z-[60] keeps the card above whatever screen it was opened from
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden select-none touch-none"
      style={{ backgroundColor: isWolf ? '#1a0000' : '#0a0a2e' }}
    >
      <Watermark playerName={playerName} />

      <div className="relative z-10 text-center px-6">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">
          Votre rôle
        </p>

        <h1
          className={`text-6xl sm:text-7xl font-black tracking-wider mb-4 ${
            isWolf ? 'text-wolf' : 'text-blue-400'
          }`}
          style={{
            textShadow: isWolf
              ? '0 0 40px rgba(139, 0, 0, 0.6), 0 0 80px rgba(139, 0, 0, 0.3)'
              : '0 0 40px rgba(59, 130, 246, 0.4), 0 0 80px rgba(59, 130, 246, 0.2)',
          }}
        >
          {isWolf ? 'LOUP' : 'VILLAGEOIS'}
        </h1>

        <p className="text-gray-500 text-base mb-2">
          {isWolf
            ? 'Éliminez les villageois sans vous faire démasquer.'
            : 'Identifiez et éliminez les loups parmi vous.'}
        </p>

        {pack.length > 0 && (
          <div className="mt-4 mb-2">
            <p className="text-red-400/70 text-sm">
              Votre meute :{' '}
              <span className="text-red-300/90 font-semibold">{pack.join(', ')}</span>
            </p>
            <p className="text-red-400/40 text-xs mt-2">
              Retenez-les : cet écran ne sera plus affiché.
            </p>
          </div>
        )}

        <p className="text-white/[0.08] text-xs mt-2 select-none">{playerName}</p>
      </div>
    </div>
  );
}

/**
 * Animated name watermark. It does not stop a capture — nothing does — but it
 * ties any circulating screenshot to the phone it came from.
 */
export function Watermark({ playerName }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap text-white/[0.04] font-bold select-none"
          style={{
            fontSize: '18px',
            top: `${(i * 9) % 100}%`,
            left: '-10%',
            width: '120%',
            transform: `rotate(-${15 + (i % 3) * 10}deg)`,
            animation: `watermark-slide ${3 + (i % 4) * 0.7}s linear infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          {/* Repeated well past the viewport width so the band still spans a
              wide screen even with a short name */}
          {Array(24).fill(`${playerName || ''} `).join('  ')}
        </div>
      ))}
    </div>
  );
}
