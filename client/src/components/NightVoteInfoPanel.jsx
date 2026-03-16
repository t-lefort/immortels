import { useState } from 'react';

/**
 * Informational panel shown during night votes.
 * IMPORTANT: Shows the SAME content for ALL players regardless of role,
 * so that someone looking at another player's phone cannot deduce their role.
 */
export default function NightVoteInfoPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-left transition-colors active:bg-gray-700/60"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-gray-300 text-sm font-medium">Rappel des votes de nuit</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 bg-gray-800/40 border border-gray-700/60 rounded-lg px-4 py-3 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5 flex-shrink-0">&#x1F43A;</span>
            <p className="text-gray-300">
              <span className="font-semibold text-red-400">Loups :</span>{' '}
              Votez pour le joueur que vous souhaitez éliminer.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5 flex-shrink-0">&#x1F33E;</span>
            <p className="text-gray-300">
              <span className="font-semibold text-blue-400">Villageois :</span>{' '}
              Votez pour un joueur que vous pensez être villageois (+1 pt si correct).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 flex-shrink-0">&#x1F47B;</span>
            <p className="text-gray-300">
              <span className="font-semibold text-green-400">Fantômes :</span>{' '}
              Votez pour le joueur que vous souhaitez éliminer.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5 flex-shrink-0">&#x1F50D;</span>
            <p className="text-gray-300">
              <span className="font-semibold text-yellow-400">Fantômes villageois :</span>{' '}
              Vous pouvez aussi identifier les loups (+1 si correct, -1 si incorrect).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
