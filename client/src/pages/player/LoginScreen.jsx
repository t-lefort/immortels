import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Zero-friction login screen.
 * Single input for first name, POST /api/player/join.
 * If collision, prompt for last initial.
 */
export default function LoginScreen() {
  const { login, error, clearError } = usePlayer();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showInitialPrompt, setShowInitialPrompt] = useState(false);
  const [initial, setInitial] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    const finalName = showInitialPrompt
      ? `${name} ${initial.toUpperCase()}.`
      : name.trim();

    if (!finalName) return;

    setSubmitting(true);
    try {
      await login(finalName);
    } catch (err) {
      // If the error suggests a name collision, show initial prompt
      if (err.message && err.message.includes('déjà')) {
        // Name exists - could be reconnection or collision
        // The server handles reconnection automatically, so this
        // shouldn't normally happen. But if it does, suggest adding initial.
        setShowInitialPrompt(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo / Title */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
          Les Immortels
        </h1>
        <p className="text-gray-500 text-lg">Loup-Garou</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <label className="block text-gray-400 text-base mb-3 text-center">
          {showInitialPrompt
            ? 'Ce prénom existe déjà. Ajoutez votre initiale.'
            : 'Entrez votre prénom'}
        </label>

        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom"
            autoFocus
            autoComplete="given-name"
            disabled={submitting}
            className="w-full px-4 py-4 rounded-xl bg-gray-800 border border-gray-700
                       text-white text-lg text-center placeholder-gray-500
                       focus:outline-none focus:border-villager focus:ring-1 focus:ring-villager
                       disabled:opacity-50 transition-colors"
          />

          {showInitialPrompt && (
            <input
              type="text"
              value={initial}
              onChange={(e) => setInitial(e.target.value.slice(0, 1))}
              placeholder="Initiale du nom (ex: D)"
              maxLength={1}
              autoFocus
              disabled={submitting}
              className="w-full px-4 py-4 rounded-xl bg-gray-800 border border-gray-700
                         text-white text-lg text-center placeholder-gray-500 uppercase
                         focus:outline-none focus:border-villager focus:ring-1 focus:ring-villager
                         disabled:opacity-50 transition-colors"
            />
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || (showInitialPrompt && !initial.trim())}
            className="w-full py-4 rounded-xl bg-villager text-white font-bold text-lg
                       active:bg-blue-800 transition-colors min-h-[56px]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Connexion...' : 'Rejoindre'}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-wolf text-center text-sm">{error}</p>
        )}
      </form>
    </div>
  );
}
