import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Witch special power prompt.
 * Shows the victim name and asks if they want to resurrect them.
 * Single use — if already used, shows "Pouvoir deja utilise".
 */
export default function SorcierePrompt() {
  const { specialPrompt, submitSpecialResponse, setSpecialPrompt } = usePlayer();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const victimName = specialPrompt?.victimName || 'Inconnu';

  async function handleChoice(resurrect) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitSpecialResponse('sorciere', { resurrect });
      setResult(resurrect ? 'resurrect' : 'skip');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-purple-800 rounded-xl p-6 max-w-sm w-full text-center">
          {result === 'resurrect' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-green-400 text-lg font-medium mb-2">Resurrection !</p>
              <p className="text-gray-400 text-sm">
                {victimName} a ete ressuscite(e). Votre pouvoir est maintenant epuise.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-700/50 border-2 border-gray-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg font-medium mb-2">Pouvoir conserve</p>
              <p className="text-gray-500 text-sm">
                Vous avez choisi de ne pas intervenir. Votre pouvoir reste disponible.
              </p>
            </>
          )}
          <button
            onClick={() => setSpecialPrompt(null)}
            className="mt-4 px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-purple-800 rounded-xl p-6 max-w-sm w-full text-center">
        {/* Header */}
        <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium uppercase tracking-wider mb-4">
          Sorciere
        </div>

        {/* Victim info */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm mb-2">Cette nuit, les loups ont tue :</p>
          <p className="text-white text-2xl font-bold text-wolf">{victimName}</p>
        </div>

        {/* Question */}
        <p className="text-white text-lg mb-6">
          Voulez-vous utiliser votre pouvoir pour le/la ressusciter ?
        </p>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Choice buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleChoice(false)}
            disabled={submitting}
            className="flex-1 py-4 px-4 rounded-xl bg-gray-700 text-gray-300 font-medium text-base
                       active:bg-gray-600 transition-colors min-h-[56px] disabled:opacity-50"
          >
            Non
          </button>
          <button
            onClick={() => handleChoice(true)}
            disabled={submitting}
            className="flex-1 py-4 px-4 rounded-xl bg-purple-700 text-white font-bold text-base
                       active:bg-purple-800 transition-colors min-h-[56px] disabled:opacity-50"
          >
            Oui, ressusciter
          </button>
        </div>
      </div>
    </div>
  );
}
