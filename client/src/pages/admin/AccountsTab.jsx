import { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/adminApi.js';

/**
 * Account administration.
 *
 * Everything here is about getting a player back onto their phone: a forgotten
 * password, a pseudo typed wrong at sign-up, a login left open on a borrowed
 * device. Roles and scores are deliberately absent — those live in the Joueurs
 * tab, behind incognito mode.
 */
export default function AccountsTab({ refreshPlayers }) {
  const [accounts, setAccounts] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [pwdId, setPwdId] = useState(null);
  const [pwdValue, setPwdValue] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setAccounts(await api.getAccounts());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(account) {
    setPwdId(null);
    setEditingId(account.id);
    setEditData({
      username: account.username || '',
      firstName: account.firstName || '',
      lastName: account.lastName || '',
    });
  }

  async function saveEdit(account) {
    setBusy(`save-${account.id}`);
    try {
      const payload = {};
      if (editData.username !== (account.username || '')) payload.username = editData.username;
      if (editData.firstName !== (account.firstName || '')) payload.firstName = editData.firstName;
      if (editData.lastName !== (account.lastName || '')) payload.lastName = editData.lastName;

      if (Object.keys(payload).length > 0) {
        await api.updateAccount(account.id, payload);
        await load();
        refreshPlayers();
        setMessage({ type: 'success', text: 'Compte mis a jour' });
      }
      setEditingId(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  /**
   * Sets (or clears) a password. Typed inline rather than through `prompt()`:
   * the admin panel opens enough dialogs for a browser to start suppressing
   * them, and a suppressed prompt looks exactly like a button that does nothing.
   */
  async function handleSetPassword(account, password) {
    setBusy(`pwd-${account.id}`);
    try {
      await api.setAccountPassword(account.id, password);
      await load();
      setPwdId(null);
      setPwdValue('');
      setMessage({
        type: 'success',
        text: password
          ? `Mot de passe de ${account.name} redefini`
          : `Mot de passe de ${account.name} efface — il en choisira un a la connexion`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  async function handleRevoke(account) {
    if (!confirm(`Deconnecter ${account.name} de son telephone ?`)) return;

    setBusy(`revoke-${account.id}`);
    try {
      await api.revokeAccountSession(account.id);
      await load();
      setMessage({ type: 'success', text: `${account.name} a ete deconnecte` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  async function handleDetach(account) {
    if (!confirm(
      `Detacher le compte de ${account.name} ?\n\n` +
      `Le pseudo et le mot de passe sont effaces. Le joueur reste dans la ` +
      `partie avec son role et son score, et pourra recreer un compte sous le ` +
      `meme prenom et nom.`
    )) return;

    setBusy(`detach-${account.id}`);
    try {
      await api.detachAccount(account.id);
      await load();
      setMessage({ type: 'success', text: `Compte de ${account.name} detache` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(needle) ||
        (a.username || '').toLowerCase().includes(needle))
    : accounts;

  const claimed = accounts.filter(a => a.username).length;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          {claimed} compte{claimed !== 1 ? 's' : ''} cree{claimed !== 1 ? 's' : ''} sur {accounts.length} joueur{accounts.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
          />
          <button
            onClick={load}
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm font-medium border border-gray-700"
          >
            Rafraichir
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2">Nom affiche</th>
              <th className="px-3 py-2">Pseudo (login)</th>
              <th className="px-3 py-2">Mot de passe</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(a => (
              <tr key={a.id} className="border-b border-gray-800/50">
                {pwdId === a.id ? (
                  <>
                    <td className="px-3 py-2 text-white font-medium">{a.name}</td>
                    <td className="px-3 py-2" colSpan="3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={pwdValue}
                          onChange={(e) => setPwdValue(e.target.value)}
                          placeholder="Nouveau mot de passe"
                          autoFocus
                          className="w-48 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                        />
                        <button
                          onClick={() => handleSetPassword(a, pwdValue)}
                          disabled={!pwdValue || busy === `pwd-${a.id}`}
                          className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                        >
                          Definir
                        </button>
                        <button
                          onClick={() => handleSetPassword(a, '')}
                          disabled={busy === `pwd-${a.id}`}
                          className="px-2 py-1 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
                          title="Le joueur choisira son mot de passe a sa prochaine connexion"
                        >
                          Effacer
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setPwdId(null); setPwdValue(''); }}
                          className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </>
                ) : editingId === a.id ? (
                  <>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <input
                          value={editData.firstName}
                          onChange={(e) => setEditData(d => ({ ...d, firstName: e.target.value }))}
                          placeholder="Prenom"
                          className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                        />
                        <input
                          value={editData.lastName}
                          onChange={(e) => setEditData(d => ({ ...d, lastName: e.target.value }))}
                          placeholder="Nom"
                          className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2" colSpan="3">
                      <input
                        value={editData.username}
                        onChange={(e) => setEditData(d => ({ ...d, username: e.target.value }))}
                        placeholder="pseudo"
                        className="w-40 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => saveEdit(a)}
                          disabled={busy === `save-${a.id}`}
                          className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-white font-medium">
                      {a.name}
                      {a.status === 'ghost' && (
                        <span className="ml-2 text-xs text-gray-500">fantome</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.username
                        ? <span className="text-gray-300 font-mono text-xs">{a.username}</span>
                        : <span className="text-yellow-500/80 text-xs">compte non cree</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        a.hasPassword ? 'bg-green-900/40 text-green-300' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {a.hasPassword ? 'defini' : 'a definir'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs ${a.hasSession ? 'text-green-400' : 'text-gray-600'}`}>
                        {a.hasSession ? 'connecte' : '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button
                          onClick={() => startEdit(a)}
                          className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setPwdId(a.id); setPwdValue(''); }}
                          className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
                        >
                          Mot de passe
                        </button>
                        {a.hasSession && (
                          <button
                            onClick={() => handleRevoke(a)}
                            disabled={busy === `revoke-${a.id}`}
                            className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700 disabled:opacity-50"
                          >
                            Deconnecter
                          </button>
                        )}
                        {a.username && (
                          <button
                            onClick={() => handleDetach(a)}
                            disabled={busy === `detach-${a.id}`}
                            className="px-2 py-1 bg-gray-800 text-gray-500 rounded text-xs hover:bg-red-900/50 hover:text-red-300 disabled:opacity-50"
                          >
                            Detacher
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan="5" className="px-3 py-6 text-center text-gray-500">
                  Aucun compte
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
