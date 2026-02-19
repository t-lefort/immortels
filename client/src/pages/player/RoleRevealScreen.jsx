import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * One-time role reveal screen.
 * Shows "LOUP" (red) or "VILLAGEOIS" (blue) with anti-screenshot protection:
 * - Animated overlay with player name as watermark
 * - Rapid CSS animation with mix-blend-mode
 * - Filter alternation
 * "J'ai compris" button to dismiss permanently (localStorage).
 */
export default function RoleRevealScreen() {
  const { player, roleRevealed, wolves, markRoleSeen } = usePlayer();
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef(null);

  const role = roleRevealed || player?.role;
  const isWolf = role === 'wolf';

  // Already seen (from DB)
  useEffect(() => {
    if (player?.role_seen) {
      setDismissed(true);
    }
  }, [player?.role_seen]);

  function handleDismiss() {
    markRoleSeen();
    setDismissed(true);
  }

  if (dismissed) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundColor: isWolf ? '#1a0000' : '#0a0a2e',
      }}
    >
      {/* Anti-screenshot watermark overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Multiple watermark layers with different animations */}
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
            {Array(8)
              .fill(`${player?.name || ''} `)
              .join('  ')}
          </div>
        ))}
      </div>

      {/* Rapid color/filter alternation to prevent clean screenshots */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
          animation: 'anti-screenshot 0.15s steps(2) infinite',
        }}
      />

      {/* Main role display */}
      <div className="relative z-10 text-center px-6">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">
          Votre rôle
        </p>

        <h1
          className={`
            text-6xl sm:text-7xl font-black tracking-wider mb-4
            ${isWolf ? 'text-wolf' : 'text-blue-400'}
          `}
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

        {/* Wolf pack members (only shown to wolves) */}
        {isWolf && wolves.length > 0 && (
          <div className="mt-4 mb-2">
            <p className="text-red-400/70 text-sm">
              Votre meute :{' '}
              <span className="text-red-300/90 font-semibold">
                {wolves
                  .filter((w) => w.id !== player?.id)
                  .map((w) => w.name)
                  .join(', ')}
              </span>
            </p>
          </div>
        )}

        {/* Player name watermark over the role */}
        <p className="text-white/[0.08] text-xs mt-2 select-none">
          {player?.name}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className={`
          relative z-10 mt-12 px-8 py-4 rounded-xl font-bold text-lg
          min-h-[56px] transition-colors
          ${isWolf
            ? 'bg-wolf/80 text-white active:bg-red-800'
            : 'bg-villager/80 text-white active:bg-blue-800'
          }
        `}
      >
        J'ai compris
      </button>

      {/* CSS animations */}
      <style>{`
        @keyframes watermark-slide {
          0% { transform: translateX(0) rotate(-15deg); }
          100% { transform: translateX(-40px) rotate(-15deg); }
        }
        @keyframes anti-screenshot {
          0% {
            background: rgba(255, 255, 255, 0.02);
            filter: hue-rotate(0deg);
          }
          50% {
            background: rgba(0, 0, 0, 0.03);
            filter: hue-rotate(180deg);
          }
          100% {
            background: rgba(255, 255, 255, 0.02);
            filter: hue-rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
