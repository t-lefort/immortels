import { useState } from 'react';
import * as api from '../../services/adminApi.js';

export default function PlayersTab({ players, refreshPlayers }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  function startEdit(player) {
    setEditingId(player.id);
    setEditData({
      name: player.name,
      role: player.role || '',
      special_role: player.special_role || '',
      status: player.status,
      score: player.score,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveEdit() {
    setLoading(true);
    try {
      const updates = {};
      const original = players.find(p => p.id === editingId);

      if (editData.name !== original.name) updates.name = editData.name;
      if (editData.role !== (original.role || '')) updates.role = editData.role || null;
      if (editData.special_role !== (original.special_role || '')) updates.special_role = editData.special_role || null;
      if (editData.status !== original.status) updates.status = editData.status;
      if (Number(editData.score) !== original.score) updates.score = Number(editData.score);

      if (Object.keys(updates).length > 0) {
        await api.updatePlayer(editingId, updates);
        refreshPlayers();
        setMessage({ type: 'success', text: `${editData.name} mis à jour` });
      }
      cancelEdit();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  }

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

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Spécial</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Éliminé par</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className={`border-b border-gray-800/50 ${
                p.status === 'ghost' ? 'opacity-60' : ''
              }`}>
                {editingId === p.id ? (
                  <>
                    <td className="px-3 py-2 text-gray-500">{p.id}</td>
                    <td className="px-3 py-2">
                      <input
                        value={editData.name}
                        onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editData.role}
                        onChange={(e) => setEditData(d => ({ ...d, role: e.target.value }))}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      >
                        <option value="">—</option>
                        <option value="wolf">Loup</option>
                        <option value="villager">Villageois</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editData.special_role}
                        onChange={(e) => setEditData(d => ({ ...d, special_role: e.target.value }))}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      >
                        <option value="">—</option>
                        <option value="maire">Maire</option>
                        <option value="sorciere">Sorcière</option>
                        <option value="protecteur">Protecteur</option>
                        <option value="voyante">Voyante</option>
                        <option value="chasseur">Chasseur</option>
                        <option value="immunite">Immunité</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData(d => ({ ...d, status: e.target.value }))}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      >
                        <option value="alive">Vivant</option>
                        <option value="ghost">Fantôme</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editData.score}
                        onChange={(e) => setEditData(d => ({ ...d, score: e.target.value }))}
                        className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{p.eliminated_by || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={saveEdit}
                          disabled={loading}
                          className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600"
                        >
                          OK
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-gray-500">{p.id}</td>
                    <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                    <td className="px-3 py-2">
                      {p.role ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          p.role === 'wolf' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                        }`}>
                          {p.role === 'wolf' ? 'Loup' : 'Villageois'}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.special_role ? (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-purple-900/50 text-purple-300">
                          {p.special_role}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        p.status === 'alive' ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {p.status === 'alive' ? 'Vivant' : 'Fantôme'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white">{p.score}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{p.eliminated_by || '—'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
                      >
                        Modifier
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
