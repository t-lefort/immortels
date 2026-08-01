import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../services/adminApi.js';

export default function SettingsTab({ refreshPlayers }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      // Use updateSettings with empty object to get current settings
      const data = await api.updateSettings({});
      setSettings(data);
    } catch { /* ignore */ }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const data = await api.updateSettings(settings);
      setSettings(data);
      setMessage({ type: 'success', text: 'Reglages sauvegardes' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!confirm('Etes-vous sur ? Toutes les donnees seront supprimees.')) return;
    if (!confirm('Confirmation finale : reinitialiser TOUTE la partie ? Joueurs, phases, votes, scores — tout sera supprime definitivement.')) return;

    setLoading(true);
    try {
      await api.resetGame();
      refreshPlayers();
      loadSettings();
      setMessage({ type: 'success', text: 'Partie reinitialisee' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const gameSettingRows = [
    { key: 'game_status', label: 'Statut de la partie', type: 'select', options: ['setup', 'in_progress', 'finished'] },
    { key: 'admin_password', label: 'Mot de passe admin', type: 'text' },
    { key: 'current_phase_id', label: 'Phase courante (ID)', type: 'text' },
    { key: 'moonless_night', label: 'Nuit sans lune', type: 'toggle' },
    { key: 'protected_player_id', label: 'Joueur protege (ID)', type: 'text' },
    { key: 'last_protected_player_id', label: 'Dernier protege (ID)', type: 'text' },
    { key: 'witch_used', label: 'Sorciere utilisee', type: 'toggle' },
    { key: 'seer_uses_remaining', label: 'Utilisations voyante restantes', type: 'number' },
    { key: 'mayor_id', label: 'Maire (ID)', type: 'text' },
    { key: 'hunter_pending', label: 'Chasseur en attente', type: 'toggle' },
  ];

  const isSetup = settings.game_status === 'setup';

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

      {/* Dashboard Control */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-2">Dashboard</h2>
        <p className="text-sm text-gray-400 mb-3">
          Force le retour du dashboard sur l'ecran de base (liste des joueurs en vie / morts).
        </p>
        <button
          onClick={async () => {
            try {
              await api.dashboardForceHome();
              setMessage({ type: 'success', text: 'Dashboard reinitialise' });
            } catch (err) {
              setMessage({ type: 'error', text: err.message });
            }
          }}
          className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
        >
          Retour ecran de base
        </button>
      </div>

      {/* Test Mode Section */}
      <div className="bg-yellow-950/30 rounded-lg p-4 border border-yellow-900/50">
        <h2 className="text-lg font-semibold text-yellow-400 mb-3">Mode test</h2>
        <p className="text-sm text-gray-400 mb-4">
          Active les raccourcis de test (skip de phases, nombre de joueurs/loups variable).
        </p>

        <div className="space-y-3">
          {/* Test mode toggle */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-gray-400 flex-shrink-0">Mode test</label>
            <button
              onClick={() => updateSetting('test_mode', settings.test_mode === '1' ? '0' : '1')}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.test_mode === '1' ? 'bg-yellow-600' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                settings.test_mode === '1' ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Number of wolves */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-gray-400 flex-shrink-0">Nombre de loups</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={settings.num_wolves ?? '8'}
                onChange={(e) => updateSetting('num_wolves', e.target.value)}
                className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
                disabled={!isSetup}
              />
              {!isSetup && (
                <span className="text-xs text-gray-500">(avant demarrage uniquement)</span>
              )}
            </div>
          </div>
        </div>

        {settings.test_mode === '1' && (
          <div className="mt-3 px-3 py-2 bg-yellow-900/30 rounded border border-yellow-800/50">
            <p className="text-xs text-yellow-300">
              Mode test actif — Les raccourcis admin sont disponibles (skip phase, reset rapide).
            </p>
          </div>
        )}
      </div>

      {/* Game Settings */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Reglages de la partie</h2>

        <div className="space-y-3">
          {gameSettingRows.map(row => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-400 flex-shrink-0">{row.label}</label>

              {row.type === 'text' && (
                <input
                  type="text"
                  value={settings[row.key] ?? ''}
                  onChange={(e) => updateSetting(row.key, e.target.value)}
                  className="w-48 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
                />
              )}

              {row.type === 'number' && (
                <input
                  type="number"
                  value={settings[row.key] ?? ''}
                  onChange={(e) => updateSetting(row.key, e.target.value)}
                  className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
                />
              )}

              {row.type === 'select' && (
                <select
                  value={settings[row.key] ?? ''}
                  onChange={(e) => updateSetting(row.key, e.target.value)}
                  className="w-48 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
                >
                  {row.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {row.type === 'toggle' && (
                <button
                  onClick={() => updateSetting(row.key, settings[row.key] === '1' ? '0' : '1')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings[row.key] === '1' ? 'bg-green-700' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                    settings[row.key] === '1' ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm font-medium"
          >
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Backup / Restore */}
      <BackupPanel onNotify={setMessage} refreshPlayers={refreshPlayers} reloadSettings={loadSettings} />

      {/* Archived games */}
      <ArchivesPanel onNotify={setMessage} />

      {/* Danger Zone — Reset */}
      <div className="bg-red-950/30 rounded-lg p-4 border border-red-900/50">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Zone dangereuse</h2>
        <p className="text-sm text-gray-400 mb-3">
          Reinitialiser supprime tous les joueurs, phases, votes et scores. Cette action est irreversible.
          Une partie terminee est automatiquement archivee avant d'etre effacee.
        </p>
        <button
          onClick={handleReset}
          disabled={loading}
          className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
        >
          Reset complet
        </button>
      </div>
    </div>
  );
}

/**
 * Export the whole game to a JSON file, and restore one back.
 *
 * Import is destructive by design (that is the point: recovering a game after
 * a mistaken reset), so it is gated behind an explicit confirmation naming
 * what is about to be overwritten.
 */
function BackupPanel({ onNotify, refreshPlayers, reloadSettings }) {
  const [busy, setBusy] = useState('');
  const fileInputRef = useRef(null);

  async function handleExport() {
    setBusy('export');
    try {
      const { filename } = await api.exportGame();
      onNotify({ type: 'success', text: `Partie exportee : ${filename}` });
    } catch (err) {
      onNotify({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  async function handleFileChosen(event) {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file twice re-triggers onChange
    event.target.value = '';
    if (!file) return;

    let snapshot;
    try {
      snapshot = JSON.parse(await file.text());
    } catch {
      onNotify({ type: 'error', text: 'Fichier illisible : ce n\'est pas un JSON valide.' });
      return;
    }

    const playerCount = Array.isArray(snapshot?.tables?.players)
      ? snapshot.tables.players.length
      : 0;
    const exportedAt = snapshot?.exportedAt
      ? new Date(snapshot.exportedAt).toLocaleString('fr-FR')
      : 'date inconnue';

    const confirmed = confirm(
      `Importer cette sauvegarde ?\n\n` +
      `Fichier : ${file.name}\n` +
      `Exporte le : ${exportedAt}\n` +
      `Joueurs : ${playerCount}\n\n` +
      `ATTENTION : la partie en cours (joueurs, phases, votes, scores) sera ` +
      `entierement remplacee. Cette action est irreversible.`
    );
    if (!confirmed) return;

    setBusy('import');
    try {
      const result = await api.importGame(snapshot);
      refreshPlayers();
      reloadSettings();
      onNotify({
        type: 'success',
        text: `Partie importee : ${result.counts.players} joueurs, ${result.counts.phases} phases, ${result.counts.votes} votes.`,
      });
    } catch (err) {
      onNotify({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h2 className="text-lg font-semibold mb-2">Sauvegarde de la partie</h2>
      <p className="text-sm text-gray-400 mb-3">
        L'export contient toute la partie dans un seul fichier JSON : joueurs, roles,
        phases, votes, epreuves et scores. L'import ecrase la partie en cours.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={!!busy}
          className="px-4 py-2 bg-villager text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm font-medium"
        >
          {busy === 'export' ? 'Export...' : 'Exporter la partie'}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!busy}
          className="px-4 py-2 bg-orange-800 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
        >
          {busy === 'import' ? 'Import...' : 'Importer une partie'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChosen}
          className="hidden"
        />
      </div>
    </div>
  );
}

/**
 * Games archived so far. These survive a reset and are what players browse
 * from the end-of-game screen.
 */
function ArchivesPanel({ onNotify }) {
  const [archives, setArchives] = useState([]);
  const [busy, setBusy] = useState('');
  const [label, setLabel] = useState(() => `Partie du ${new Date().toLocaleDateString('fr-FR')}`);
  // Feedback stays next to the button: the page-level banner sits far above,
  // off screen by the time you have scrolled down to the archives.
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      setArchives(await api.getArchives());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Archives the current game. The label used to come from a `prompt()`, which
   * a browser silently answers `null` once the user has ticked "prevent this
   * page from creating more dialogs" — and the admin panel opens plenty of
   * them. The button then did nothing at all, with no error to show for it.
   */
  async function handleArchiveNow() {
    setBusy('create');
    setStatus(null);
    try {
      const archive = await api.createArchive(label.trim());
      await load();
      setStatus({ type: 'success', text: `Archivee : ${archive.label}` });
      onNotify({ type: 'success', text: 'Partie archivee' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
      onNotify({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  async function handleDelete(archive) {
    if (!confirm(`Supprimer definitivement l'archive « ${archive.label} » ?`)) return;

    setBusy(`delete-${archive.id}`);
    try {
      await api.deleteArchive(archive.id);
      await load();
      onNotify({ type: 'success', text: 'Archive supprimee' });
    } catch (err) {
      onNotify({ type: 'error', text: err.message });
    }
    setBusy('');
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Parties archivees ({archives.length})</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Conservees malgre un reset. Les joueurs peuvent les consulter depuis
          leur profil. Une partie archivee avant la fin reste reservee a l'admin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom de cette partie"
          className="flex-1 min-w-[12rem] px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={handleArchiveNow}
          disabled={!!busy}
          className="px-3 py-1.5 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-xs font-medium border border-gray-700 whitespace-nowrap"
        >
          {busy === 'create' ? 'Archivage...' : 'Archiver maintenant'}
        </button>
      </div>

      {status && (
        <p className={`text-xs mb-3 ${status.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {status.text}
        </p>
      )}

      {archives.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucune partie archivee</p>
      ) : (
        <div className="space-y-1">
          {archives.map(a => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800/50 rounded-lg"
            >
              <div className="min-w-0">
                <div className="text-sm text-white truncate">
                  {a.label}
                  {a.gameStatus && a.gameStatus !== 'finished' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[0.65rem] bg-yellow-900/50 text-yellow-300 align-middle">
                      partie non terminee — admin seulement
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {formatArchiveDate(a.archivedAt)}
                  {a.winner && ` · Victoire des ${a.winner === 'wolves' ? 'Loups' : 'Villageois'}`}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a)}
                disabled={busy === `delete-${a.id}`}
                className="px-2 py-1 text-xs text-gray-500 hover:text-red-400 disabled:opacity-50 whitespace-nowrap"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatArchiveDate(value) {
  if (!value) return 'Date inconnue';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR');
}
