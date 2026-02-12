import { usePlayer } from '../../contexts/PlayerContext.jsx';
import CountdownTimer from '../../components/CountdownTimer.jsx';

/**
 * Between-phases waiting screen.
 * Shows player status, list of eliminated players.
 * Role is NOT shown here.
 */
export default function WaitingScreen() {
  const { player, players, eliminated, timerDuration, setTimerDuration, connected } = usePlayer();

  const isGhost = player?.status === 'ghost';
  const alivePlayers = players.filter((p) => p.status === 'alive');
  const ghostPlayers = players.filter((p) => p.status === 'ghost');

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-20">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">{player?.name}</h2>
        <span
          className={`
            inline-block px-3 py-1 rounded-full text-sm font-medium
            ${isGhost
              ? 'bg-ghost/20 text-green-400 border border-ghost/40'
              : 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
            }
          `}
        >
          {isGhost ? 'Fantôme' : 'Vivant'}
        </span>
      </div>

      {/* Timer if active */}
      {timerDuration && (
        <div className="mb-6 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <CountdownTimer
            duration={timerDuration}
            onComplete={() => setTimerDuration(null)}
          />
        </div>
      )}

      {/* Waiting message */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-gray-400">En attente de la prochaine phase...</p>
      </div>

      {/* Game stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{alivePlayers.length}</p>
          <p className="text-gray-500 text-sm">Vivants</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-ghost">{ghostPlayers.length}</p>
          <p className="text-gray-500 text-sm">Fantômes</p>
        </div>
      </div>

      {/* Eliminated players */}
      {ghostPlayers.length > 0 && (
        <div>
          <h3 className="text-gray-500 font-semibold text-sm uppercase tracking-wider mb-3">
            Joueurs éliminés
          </h3>
          <div className="space-y-2">
            {ghostPlayers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-gray-800/30 border border-gray-800
                           rounded-lg px-4 py-3"
              >
                <span className="text-gray-400">{p.name}</span>
                <span className="text-ghost/60 text-xs">Fantôme</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection status */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-2 bg-gray-900/90 border border-gray-800 rounded-full px-4 py-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-500 text-xs">
            {connected ? 'Connecté' : 'Reconnexion...'}
          </span>
        </div>
      </div>
    </div>
  );
}
