import { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import { RoleCard, Watermark } from '../../components/RoleSheet.jsx';

/**
 * One-time role reveal at the start of the game.
 *
 * The role is only shown while the player holds their finger down, and the
 * same card can later be re-opened — and faked — from "Ma carte". See
 * RoleSheet.jsx for why making the screenshot worthless beats trying to
 * prevent it.
 *
 * "J'ai compris" dismisses the screen permanently (tracked server-side via
 * players.role_seen).
 */
export default function RoleRevealScreen() {
  const { player, roleRevealed, wolves, markRoleSeen } = usePlayer();
  const [dismissed, setDismissed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hasLooked, setHasLooked] = useState(false);

  const role = roleRevealed || player?.role;
  const isWolf = role === 'wolf';

  // Already seen (from DB)
  useEffect(() => {
    if (player?.role_seen) {
      setDismissed(true);
    }
  }, [player?.role_seen]);

  // Drop the card when the tab is backgrounded
  useEffect(() => {
    function hide() {
      setHolding(false);
    }
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('pagehide', hide);
    };
  }, []);

  function handleDismiss() {
    markRoleSeen();
    setDismissed(true);
  }

  function startHolding() {
    setHolding(true);
    setHasLooked(true);
  }

  if (dismissed) {
    return null;
  }

  if (holding) {
    return (
      <RoleCard
        isWolf={isWolf}
        playerName={player?.name}
        pack={isWolf ? wolves.filter(w => w.id !== player?.id).map(w => w.name) : []}
        onRelease={() => setHolding(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      <Watermark playerName={player?.name} />

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-3">
            Votre rôle
          </p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Mettez-vous à l'abri des regards, puis maintenez le doigt appuyé
            sur le cadre. La carte disparaît dès que vous relâchez.
          </p>
        </div>

        <button
          onPointerDown={startHolding}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-700
                     bg-gray-900/60 flex items-center justify-center text-gray-600
                     text-sm select-none touch-none"
        >
          Maintenir appuyé
        </button>

        <div className="text-center">
          <p className="text-gray-600 text-[11px] leading-relaxed mb-6">
            Vous pourrez la revoir à tout moment via « Ma carte ». Chacun peut
            y afficher la carte de son choix : une capture d'écran ne prouve rien.
          </p>

          <button
            onClick={handleDismiss}
            disabled={!hasLooked}
            className={`px-8 py-4 rounded-xl font-bold text-lg min-h-[56px] transition-colors ${
              hasLooked
                ? 'bg-gray-700 text-white active:bg-gray-600'
                : 'bg-gray-900 text-gray-700 cursor-not-allowed'
            }`}
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
