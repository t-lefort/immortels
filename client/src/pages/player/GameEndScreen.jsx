import { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import { rankScoreboard } from '../../utils/scoreRanking.js';
import * as playerApi from '../../services/playerApi.js';
import ArchivedGameViewer from '../../components/ArchivedGameViewer.jsx';

/**
 * Game end screen.
 * Shows the outcome, the player's own result, and — now that the game is
 * over — lets them browse previous games.
 */
export default function GameEndScreen() {
  const { player, winner, scoreboard } = usePlayer();

  const wolvesWin = winner === 'wolves';

  const rankedScoreboard = rankScoreboard(scoreboard || []);
  const myEntry = rankedScoreboard.find((p) => p.id === player?.id);
  const myScore = myEntry?.score ?? player?.score ?? 0;
  const myRank = myEntry?.rank ?? null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="flex flex-col items-center max-w-md mx-auto">
        <h1 className="text-4xl font-black text-white mb-4 text-center">
          Partie terminée !
        </h1>
        {winner && (
          <div className={`text-2xl font-bold mb-4 text-center ${wolvesWin ? 'text-red-400' : 'text-blue-400'}`}>
            {wolvesWin ? 'Victoire des Loups' : 'Victoire des Villageois'}
          </div>
        )}
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
            {player.special_role.includes(',') ? 'Roles speciaux' : 'Role special'} : {player.special_role.split(',').join(', ')}
          </p>
        )}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl px-8 py-5 text-center">
          <p className="text-gray-500 text-sm mb-1">Votre score</p>
          <p className="text-3xl font-bold text-white">{myScore}</p>
          {myRank && (
            <p className="text-gray-400 text-sm mt-2">
              {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `${myRank}e`} sur {rankedScoreboard.length}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto mt-10">
        <PreviousGames />
      </div>
    </div>
  );
}

/**
 * Browser for past games. Only reachable from the end screen — the server
 * refuses the archive endpoints while a game is in progress.
 */
function PreviousGames() {
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    playerApi.getArchives()
      .then((data) => {
        if (!cancelled) setArchives(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function openArchive(id) {
    if (selected?.id === id) {
      setSelected(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      setSelected(await playerApi.getArchive(id));
    } catch (err) {
      setError(err.message);
    }
    setLoadingDetail(false);
  }

  if (loadingList) {
    return <p className="text-gray-600 text-sm text-center">Chargement des parties précédentes...</p>;
  }

  if (archives.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-gray-400 font-semibold text-sm uppercase tracking-wider text-center">
        Parties précédentes
      </h2>

      {error && <p className="text-wolf text-sm text-center">{error}</p>}

      <div className="space-y-2">
        {archives.map(a => (
          <button
            key={a.id}
            onClick={() => openArchive(a.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
              selected?.id === a.id
                ? 'bg-gray-800 border-gray-600'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="text-white text-sm font-medium">{a.label}</div>
            <div className="text-gray-500 text-xs mt-0.5">
              {a.winner
                ? `Victoire des ${a.winner === 'wolves' ? 'Loups' : 'Villageois'}`
                : 'Sans vainqueur enregistré'}
            </div>
          </button>
        ))}
      </div>

      {loadingDetail && <p className="text-gray-600 text-sm text-center">Chargement...</p>}
      {selected && !loadingDetail && <ArchivedGameViewer archive={selected} />}
    </div>
  );
}
