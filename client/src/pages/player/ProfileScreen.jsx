import { useState, useEffect, useCallback } from 'react';
import * as playerApi from '../../services/playerApi.js';
import ArchivedGameViewer from '../../components/ArchivedGameViewer.jsx';

/**
 * Player profile — a full-screen overlay reachable from anywhere in the game.
 *
 * Three things live here: the login pseudo, the password, and the past games.
 * The display name is shown but not editable: every other player identifies
 * you by it during a game, so renaming yourself mid-game would be a disguise.
 * Only the admin can change it (Comptes tab).
 */
export default function ProfileScreen({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      setProfile(await playerApi.getProfile());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Mon profil</h1>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700"
          >
            Fermer
          </button>
        </div>

        {message && (
          <div className={`px-4 py-2 rounded-lg text-sm mb-4 ${
            message.type === 'success'
              ? 'bg-green-900/50 text-green-300 border border-green-800'
              : 'bg-red-900/50 text-red-300 border border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : (
          <div className="space-y-4">
            <IdentityCard profile={profile} />
            <UsernameForm profile={profile} onSaved={(u) => {
              setProfile(p => ({ ...p, username: u }));
              setMessage({ type: 'success', text: 'Pseudo mis à jour' });
            }} onError={(text) => setMessage({ type: 'error', text })} />
            <PasswordForm
              hasPassword={profile?.hasPassword}
              onSaved={() => {
                setProfile(p => ({ ...p, hasPassword: true }));
                setMessage({ type: 'success', text: 'Mot de passe mis à jour' });
              }}
              onError={(text) => setMessage({ type: 'error', text })}
            />
            <PreviousGames />
            <LogoutButton onError={(text) => setMessage({ type: 'error', text })} />
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityCard({ profile }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Nom affiché</p>
      <p className="text-white text-xl font-bold">{profile?.name}</p>
      <p className="text-gray-600 text-xs mt-2">
        C'est sous ce nom que les autres joueurs vous voient. Seul l'administrateur
        peut le modifier.
      </p>
    </div>
  );
}

function UsernameForm({ profile, onSaved, onError }) {
  const [username, setUsername] = useState(profile?.username || '');
  const [busy, setBusy] = useState(false);

  const unchanged = username.trim().toLowerCase() === (profile?.username || '');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await playerApi.updateUsername(username);
      onSaved(result.username);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <div>
        <label className="text-gray-500 text-xs uppercase tracking-widest">Pseudo de connexion</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-villager"
        />
        <p className="text-gray-600 text-xs mt-1.5">
          Sert uniquement à vous connecter. Lettres, chiffres, points, tirets.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy || unchanged || !username.trim()}
        className="w-full py-2.5 bg-villager text-white rounded-lg font-medium disabled:opacity-40"
      >
        {busy ? 'Enregistrement...' : 'Changer de pseudo'}
      </button>
    </form>
  );
}

function PasswordForm({ hasPassword, onSaved, onError }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) {
      onError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await playerApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      onSaved();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <p className="text-gray-500 text-xs uppercase tracking-widest">Mot de passe</p>

      {hasPassword && (
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Mot de passe actuel"
          autoComplete="current-password"
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-villager"
        />
      )}
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="Nouveau mot de passe"
        autoComplete="new-password"
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-villager"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirmer"
        autoComplete="new-password"
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-villager"
      />
      <button
        type="submit"
        disabled={busy || !next || !confirm}
        className="w-full py-2.5 bg-villager text-white rounded-lg font-medium disabled:opacity-40"
      >
        {busy ? 'Enregistrement...' : 'Changer de mot de passe'}
      </button>
    </form>
  );
}

/**
 * Past games. Only archives of finished games are returned by the server, so
 * nothing here can leak a role from the game currently being played.
 */
function PreviousGames() {
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    playerApi.getArchives()
      .then((data) => { if (!cancelled) setArchives(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function open(id) {
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

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <p className="text-gray-500 text-xs uppercase tracking-widest">Parties précédentes</p>

      {loading && <p className="text-gray-600 text-sm">Chargement...</p>}
      {error && <p className="text-wolf text-sm">{error}</p>}
      {!loading && archives.length === 0 && !error && (
        <p className="text-gray-600 text-sm">Aucune partie terminée pour le moment.</p>
      )}

      <div className="space-y-2">
        {archives.map(a => (
          <button
            key={a.id}
            onClick={() => open(a.id)}
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

      {loadingDetail && <p className="text-gray-600 text-sm">Chargement...</p>}
      {selected && !loadingDetail && <ArchivedGameViewer archive={selected} />}
    </div>
  );
}

function LogoutButton({ onError }) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (!confirm('Se déconnecter de ce téléphone ?')) return;
    setBusy(true);
    try {
      await playerApi.logout();
      window.location.reload();
    } catch (err) {
      onError(err.message);
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="w-full py-2.5 bg-gray-900 border border-gray-800 text-gray-500 rounded-lg text-sm hover:text-gray-300 disabled:opacity-50"
    >
      Se déconnecter
    </button>
  );
}
