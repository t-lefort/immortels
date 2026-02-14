import { Link } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Pre-game waiting screen.
 * Shows "En attente du début de la partie..." with player count.
 */
export default function LobbyScreen() {
  const { player, players, connected } = usePlayer();

  const playerCount = players.length;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Player identity */}
      <div className="mb-10 text-center">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">
          Connecté en tant que
        </p>
        <h2 className="text-3xl font-bold text-white">{player?.name}</h2>
      </div>

      {/* Waiting animation */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-villager animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-villager animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-villager animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-gray-400 text-lg">
          En attente du début de la partie...
        </p>
      </div>

      {/* Player count */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-8 py-5 text-center">
        <p className="text-4xl font-bold text-white mb-1">{playerCount}</p>
        <p className="text-gray-400 text-sm">
          {playerCount === 1 ? 'joueur connecté' : 'joueurs connectés'}
        </p>
      </div>

      {/* Rules link */}
      <Link
        to="/rules"
        className="mt-6 text-gray-500 hover:text-gray-300 transition-colors text-sm underline underline-offset-4"
      >
        Règles du jeu
      </Link>

      {/* Connection indicator */}
      <div className="mt-8 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-500 text-sm">
          {connected ? 'Connecté' : 'Reconnexion...'}
        </span>
      </div>
    </div>
  );
}
