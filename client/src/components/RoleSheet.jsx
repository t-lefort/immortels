import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePlayer } from '../contexts/PlayerContext.jsx';
import { buildFakePack } from '../utils/fakePack.js';

/**
 * "Ma carte" — the only place a player can look at their role after the
 * initial reveal.
 *
 * A web page cannot stop a screenshot: no browser API exists, and a second
 * phone photographing the screen defeats anything we could build. So instead
 * of trying to prevent the capture, this component makes the capture
 * worthless as proof — any player can display any role. Once everybody knows
 * that, "look at my screen, I'm a villager" stops being an argument.
 *
 * Two rules make the bluff undetectable:
 *  - the card is only rendered while a finger is held down, and the
 *    real/fake selector is hidden during that time, so a screenshot never
 *    shows which mode produced it;
 *  - the chosen mode is never persisted or sent to the server.
 *
 * The card also hides itself when the tab loses focus, which is when the OS
 * screenshot UI typically takes over.
 */

const MODES = [
  { value: 'real', label: 'Mon rôle' },
  { value: 'villager', label: 'Villageois' },
  { value: 'wolf', label: 'Loup' },
];

export default function RoleSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl bg-gray-800/70 border border-gray-700
                   text-gray-300 text-sm font-medium active:bg-gray-700/70 transition-colors"
      >
        Ma carte
      </button>

      {open && <RoleSheetModal onClose={() => setOpen(false)} />}
    </>
  );
}

function RoleSheetModal({ onClose }) {
  const { player, players, wolves, wolfCount } = usePlayer();
  const [mode, setMode] = useState('real');
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef(null);

  const stopHolding = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }, []);

  // Release the card as soon as the tab is backgrounded or loses focus.
  useEffect(() => {
    function hide() {
      stopHolding();
    }
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('pagehide', hide);
    };
  }, [stopHolding]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  function startHolding() {
    // Small delay so a stray tap while scrolling doesn't flash the card
    holdTimer.current = setTimeout(() => setHolding(true), 120);
  }

  const displayedRole = mode === 'real' ? player?.role : mode;
  const isWolf = displayedRole === 'wolf';

  // A wolf card always carries a pack, so a faked one must carry a decoy —
  // otherwise a pack-less Loup card would prove the holder is a villager.
  // See utils/fakePack.js for the constraints the decoy has to satisfy.
  const showingRealWolfCard = mode === 'real' && player?.role === 'wolf';
  const pack = useMemo(() => {
    if (!isWolf) return [];
    if (showingRealWolfCard) {
      return wolves.filter(w => w.id !== player?.id).map(w => w.name);
    }
    return buildFakePack({ selfId: player?.id, players, wolfCount });
  }, [isWolf, showingRealWolfCard, wolves, players, wolfCount, player?.id]);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Held state: nothing but the card. No selector, no chrome — a capture
          taken now cannot reveal whether it is the real role or not. */}
      {holding ? (
        <RoleCard
          isWolf={isWolf}
          playerName={player?.name}
          pack={pack}
          onRelease={stopHolding}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Ma carte</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Maintenez le doigt appuyé sur le cadre pour afficher la carte.
              Elle disparaît dès que vous relâchez.
            </p>
          </div>

          <button
            onPointerDown={startHolding}
            onPointerUp={stopHolding}
            onPointerLeave={stopHolding}
            onPointerCancel={stopHolding}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full max-w-xs aspect-[3/4] rounded-2xl border-2 border-dashed
                       border-gray-700 bg-gray-900/60 flex items-center justify-center
                       text-gray-600 text-sm select-none touch-none"
          >
            Maintenir appuyé
          </button>

          <div className="w-full max-w-xs">
            <p className="text-gray-500 text-xs text-center mb-2">
              Carte affichée
            </p>
            <div className="flex gap-1.5">
              {MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    mode === m.value
                      ? 'bg-gray-700 text-white border border-gray-500'
                      : 'bg-gray-900 text-gray-500 border border-gray-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-[11px] text-center mt-3 leading-relaxed">
              Tout le monde peut afficher la carte de son choix : une capture
              d'écran ne prouve donc rien.
            </p>
          </div>

          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium
                       active:bg-gray-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The card itself. Identical markup whether the role is real or faked.
 */
export function RoleCard({ isWolf, playerName, pack = [], onRelease }) {
  return (
    <div
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      // z-[60] keeps the card above the screen it was opened from — the
      // waiting screen's connection pill would otherwise paint on top of it.
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
