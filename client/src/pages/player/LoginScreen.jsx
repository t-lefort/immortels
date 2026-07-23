import { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';

/**
 * Account login / registration.
 *
 * The pseudo is only ever used to sign in — every screen in the game shows
 * "Prénom Nom" instead, so players recognise each other by their real name.
 */
export default function LoginScreen() {
  const { login, register, error, clearError } = usePlayer();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const isRegister = mode === 'register';

  function switchMode(next) {
    clearError();
    setMode(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      if (isRegister) {
        await register({
          username: username.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      } else {
        await login(username.trim(), password);
      }
    } catch {
      // Error surfaced through context
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = isRegister
    ? username.trim() && password && firstName.trim() && lastName.trim()
    : username.trim() && password;

  const inputClass = `w-full px-4 py-4 rounded-xl bg-gray-800 border border-gray-700
                      text-white text-lg placeholder-gray-500
                      focus:outline-none focus:border-villager focus:ring-1 focus:ring-villager
                      disabled:opacity-50 transition-colors`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      {/* Logo / Title */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
          Les Immortels
        </h1>
        <p className="text-gray-500 text-lg">Loup-Garou</p>
      </div>

      {/* Mode switch */}
      <div className="w-full max-w-sm flex gap-1.5 mb-6 p-1 bg-gray-900 rounded-xl border border-gray-800">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            !isRegister ? 'bg-gray-700 text-white' : 'text-gray-500'
          }`}
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isRegister ? 'bg-gray-700 text-white' : 'text-gray-500'
          }`}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        {isRegister && (
          <>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              autoComplete="given-name"
              disabled={submitting}
              className={inputClass}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              autoComplete="family-name"
              disabled={submitting}
              className={inputClass}
            />
          </>
        )}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo"
          autoFocus={!isRegister}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          disabled={submitting}
          className={inputClass}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          disabled={submitting}
          className={inputClass}
        />

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full py-4 rounded-xl bg-villager text-white font-bold text-lg
                     active:bg-blue-800 transition-colors min-h-[56px]
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? (isRegister ? 'Création...' : 'Connexion...')
            : (isRegister ? 'Créer mon compte' : 'Se connecter')}
        </button>

        <p className="text-gray-600 text-xs text-center leading-relaxed pt-1">
          {isRegister
            ? 'Votre prénom et votre nom sont affichés aux autres joueurs. Le pseudo sert uniquement à vous connecter.'
            : 'Première connexion ? Le mot de passe que vous saisissez devient le vôtre.'}
        </p>

        {error && (
          <p className="mt-2 text-wolf text-center text-sm">{error}</p>
        )}
      </form>
    </div>
  );
}
