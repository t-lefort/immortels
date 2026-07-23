import { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import { RoleCard, Watermark } from '../../components/RoleCard.jsx';

/**
 * The one and only time a player sees their role.
 *
 * Shown once at game start and never again — dismissing it is permanent
 * (tracked server-side via players.role_seen). Wolves have to memorise their
 * pack here, because the night vote list deliberately gives them no hint:
 * marking the pack there would make a wolf's screen differ from a villager's.
 *
 * The card is only rendered while a finger is held down, and it can be shown
 * as a Villageois card whatever the real role is. A screenshot cannot be
 * prevented — no browser API can, and a second phone photographing the screen
 * defeats anything done client-side — so the capture is made worthless
 * instead: since anyone could have captured a Villageois card at this very
 * moment, producing one later proves nothing.
 *
 * Two details make the bluff undetectable:
 *  - the real/fake selector is hidden while the card is held, so a capture
 *    never shows which mode produced it;
 *  - the choice is never persisted nor sent to the server.
 *
 * Only the villager card is fakeable. A fake wolf card would need an invented
 * pack, and an early screenshot would freeze those names while the village
 * keeps learning roles — the day one of them is publicly cleared, that old
 * capture would prove its holder was never a wolf.
 */

const MODES = [
  { value: 'real', label: 'Mon rôle' },
  { value: 'villager', label: 'Villageois' },
];

export default function RoleRevealScreen() {
  const { player, roleRevealed, wolves, markRoleSeen } = usePlayer();
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState('real');
  const [holding, setHolding] = useState(false);
  // Only a look at the REAL card counts: someone who peeked at the fake one
  // and dismissed would never learn their own role.
  const [sawRealRole, setSawRealRole] = useState(false);

  const realRole = roleRevealed || player?.role;
  const displayedRole = mode === 'real' ? realRole : 'villager';
  const isWolf = displayedRole === 'wolf';

  // 'villager' is the only fake mode, so a wolf card is always genuine and
  // always carries the real pack.
  const pack = isWolf
    ? wolves.filter(w => w.id !== player?.id).map(w => w.name)
    : [];

  // Already seen (from DB)
  useEffect(() => {
    if (player?.role_seen) {
      setDismissed(true);
    }
  }, [player?.role_seen]);

  // Drop the card when the tab is backgrounded — that is when the OS
  // screenshot UI usually takes over.
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
    if (mode === 'real') setSawRealRole(true);
  }

  if (dismissed) {
    return null;
  }

  if (holding) {
    return (
      <RoleCard
        isWolf={isWolf}
        playerName={player?.name}
        pack={pack}
        onRelease={() => setHolding(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 py-8"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      <Watermark playerName={player?.name} />

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-6">
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

        <div className="w-full">
          <p className="text-gray-500 text-xs text-center mb-2">Carte affichée</p>
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
            Tout le monde peut afficher une carte Villageois, qu'il le soit ou
            non : une capture d'écran ne prouve donc rien.
          </p>
        </div>

        <div className="text-center">
          <p className="text-amber-500/60 text-[11px] leading-relaxed mb-4">
            Cet écran ne s'affichera qu'une seule fois. Retenez bien votre rôle
            {realRole === 'wolf' ? ' et votre meute' : ''}.
          </p>

          <button
            onClick={handleDismiss}
            disabled={!sawRealRole}
            className={`px-8 py-4 rounded-xl font-bold text-lg min-h-[56px] transition-colors ${
              sawRealRole
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
