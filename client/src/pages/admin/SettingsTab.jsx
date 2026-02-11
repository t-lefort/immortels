import { useState, useEffect } from 'react';
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
      setMessage({ type: 'success', text: 'Réglages sauvegardés' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!confirm('Réinitialiser TOUTE la partie ? Joueurs, phases, votes — tout sera supprimé.')) return;
    if (!confirm('Êtes-vous vraiment sûr ?')) return;

    setLoading(true);
    try {
      await api.resetGame();
      refreshPlayers();
      loadSettings();
      setMessage({ type: 'success', text: 'Partie réinitialisée' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const settingRows = [
    { key: 'game_status', label: 'Statut de la partie', type: 'select', options: ['setup', 'in_progress', 'finished'] },
    { key: 'admin_password', label: 'Mot de passe admin', type: 'text' },
    { key: 'num_wolves', label: 'Nombre de loups', type: 'number' },
    { key: 'current_phase_id', label: 'Phase courante (ID)', type: 'text' },
    { key: 'moonless_night', label: 'Nuit sans lune', type: 'toggle' },
    { key: 'protected_player_id', label: 'Joueur protégé (ID)', type: 'text' },
    { key: 'last_protected_player_id', label: 'Dernier protégé (ID)', type: 'text' },
    { key: 'witch_used', label: 'Sorcière utilisée', type: 'toggle' },
    { key: 'seer_uses_remaining', label: 'Utilisations voyante restantes', type: 'number' },
    { key: 'mayor_id', label: 'Maire (ID)', type: 'text' },
    { key: 'hunter_pending', label: 'Chasseur en attente', type: 'toggle' },
  ];

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

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Réglages de la partie</h2>

        <div className="space-y-3">
          {settingRows.map(row => (
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

      {/* Reset */}
      <div className="bg-red-950/30 rounded-lg p-4 border border-red-900/50">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Zone dangereuse</h2>
        <p className="text-sm text-gray-400 mb-3">
          Réinitialiser supprime tous les joueurs, phases, votes et scores.
        </p>
        <button
          onClick={handleReset}
          disabled={loading}
          className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
        >
          Réinitialiser la partie
        </button>
      </div>
    </div>
  );
}
