import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Game end screen.
 * Shows that the game is finished.
 */
export default function GameEndScreen() {
  const { player } = usePlayer();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-black text-white mb-4 text-center">
        Partie terminée !
      </h1>
      <p className="text-gray-400 text-lg text-center mb-8">
        Merci d'avoir joué, {player?.name} !
      </p>
      <div
        className={`
          inline-block px-6 py-3 rounded-full text-xl font-bold
          ${player?.role === 'wolf'
            ? 'bg-wolf/20 text-wolf border border-wolf/40'
            : 'bg-villager/20 text-blue-400 border border-blue-800/40'
          }
        `}
      >
        Vous étiez {player?.role === 'wolf' ? 'LOUP' : 'VILLAGEOIS'}
      </div>
      {player?.special_role && (
        <p className="text-yellow-400 text-sm mt-3">
          Rôle spécial : {player.special_role}
        </p>
      )}
      <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl px-8 py-5 text-center">
        <p className="text-gray-500 text-sm mb-1">Votre score</p>
        <p className="text-3xl font-bold text-white">{player?.score || 0}</p>
      </div>
    </div>
  );
}
