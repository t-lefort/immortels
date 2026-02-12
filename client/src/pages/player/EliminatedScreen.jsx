import { useState } from 'react';

/**
 * Transition screen shown when a player is eliminated.
 * "Vous êtes devenu un Fantôme"
 * Explains ghost powers.
 */
export default function EliminatedScreen({ onContinue }) {
  const [read, setRead] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Ghost icon */}
      <div className="w-20 h-20 rounded-full bg-ghost/20 border-2 border-ghost flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-black text-ghost mb-3 text-center">
        Vous êtes devenu un Fantôme
      </h1>

      <p className="text-gray-400 text-center text-lg mb-8">
        Votre aventure n'est pas terminée...
      </p>

      {/* Ghost powers explanation */}
      <div className="bg-gray-800/50 border border-ghost/30 rounded-xl p-5 w-full max-w-sm mb-8">
        <h3 className="text-ghost font-semibold text-sm uppercase tracking-wider mb-4">
          Pouvoirs des fantômes
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="text-ghost text-lg mt-0.5">1.</span>
            <div>
              <p className="text-white font-medium">Vote d'élimination</p>
              <p className="text-gray-500 text-sm">
                Chaque nuit, votez pour éliminer un joueur vivant.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-ghost text-lg mt-0.5">2.</span>
            <div>
              <p className="text-white font-medium">Identification des loups</p>
              <p className="text-gray-500 text-sm">
                Si vous étiez villageois, identifiez qui sont les loups.
                +1 point par identification correcte, -1 si incorrect.
              </p>
            </div>
          </li>
        </ul>
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="px-8 py-4 rounded-xl bg-ghost text-white font-bold text-lg
                   active:bg-green-800 transition-colors min-h-[56px]"
      >
        J'ai compris
      </button>
    </div>
  );
}
