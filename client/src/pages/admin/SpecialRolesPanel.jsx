import { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/adminApi.js';

/**
 * Admin panel for managing special role powers during a phase.
 * Shows available powers, their status, and controls to trigger/skip/force them.
 */
export default function SpecialRolesPanel({ players, currentPhase }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState(null);
  const [forceTarget, setForceTarget] = useState({});

  const alivePlayers = players.filter(p => p.status === 'alive');

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api.getSpecialRolesStatus();
      setStatus(data);
    } catch (err) {
      console.warn('Could not load special roles status:', err.message);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    // Refresh periodically while a phase is active
    const interval = setInterval(refreshStatus, 3000);
    return () => clearInterval(interval);
  }, [refreshStatus, currentPhase]);

  async function handleTrigger(power, extra = {}) {
    setLoading(power);
    setMessage(null);
    try {
      await api.triggerSpecialPower({ power, ...extra });
      setMessage({ type: 'success', text: `${powerLabels[power] || power} activé` });
      refreshStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleSkip(power) {
    setLoading(`skip_${power}`);
    setMessage(null);
    try {
      await api.skipSpecialPower(power);
      setMessage({ type: 'success', text: `${powerLabels[power] || power} passé` });
      refreshStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  async function handleForce(power, params) {
    setLoading(`force_${power}`);
    setMessage(null);
    try {
      await api.forceSpecialPower({ power, ...params });
      setMessage({ type: 'success', text: `${powerLabels[power] || power} forcé` });
      setForceTarget(prev => ({ ...prev, [power]: null }));
      refreshStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading('');
  }

  if (!status) return null;

  const isNight = currentPhase?.type === 'night';
  const isCouncil = currentPhase?.type === 'village_council';

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        Pouvoirs Spéciaux
        <button
          onClick={refreshStatus}
          className="text-xs text-gray-400 hover:text-white px-2 py-0.5 bg-gray-800 rounded"
        >
          Rafraichir
        </button>
      </h2>

      {message && (
        <div className={`px-3 py-2 rounded-lg text-sm mb-3 ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
        </div>
      )}

      <div className="space-y-3">
        {/* Night powers */}
        {isNight && (
          <>
            <ProtecteurPanel
              data={status.protecteur}
              players={alivePlayers}
              loading={loading}
              forceTarget={forceTarget.protecteur}
              setForceTarget={(v) => setForceTarget(prev => ({ ...prev, protecteur: v }))}
              onTrigger={() => handleTrigger('protecteur')}
              onSkip={() => handleSkip('protecteur')}
              onForce={(targetId) => handleForce('protecteur', { targetId })}
            />
            <SorcierePanel
              data={status.sorciere}
              players={alivePlayers}
              loading={loading}
              forceTarget={forceTarget.sorciere}
              setForceTarget={(v) => setForceTarget(prev => ({ ...prev, sorciere: v }))}
              onTrigger={(victimId) => handleTrigger('sorciere', { victimId })}
              onSkip={() => handleSkip('sorciere')}
              onForceResurrect={(targetId) => handleForce('sorciere', { decision: 'resurrect', targetId })}
              onForceSkip={() => handleForce('sorciere', { decision: 'skip' })}
            />
            <VoyantePanel
              data={status.voyante}
              players={alivePlayers}
              loading={loading}
              forceTarget={forceTarget.voyante}
              setForceTarget={(v) => setForceTarget(prev => ({ ...prev, voyante: v }))}
              onTrigger={() => handleTrigger('voyante')}
              onSkip={() => handleSkip('voyante')}
              onForce={(targetId) => handleForce('voyante', { targetId })}
            />
          </>
        )}

        {/* Hunter panel (appears whenever a hunter is pending) */}
        {status.chasseur.pending && (
          <ChasseurPanel
            data={status.chasseur}
            players={alivePlayers}
            loading={loading}
            forceTarget={forceTarget.chasseur}
            setForceTarget={(v) => setForceTarget(prev => ({ ...prev, chasseur: v }))}
            onForce={(targetId) => handleForce('chasseur', { targetId })}
            onSkip={() => handleSkip('chasseur')}
          />
        )}

        {/* Mayor succession panel */}
        {status.maire.successionPending && (
          <MayorSuccessionPanel
            data={status.maire}
            players={alivePlayers}
            loading={loading}
            forceTarget={forceTarget.mayor_succession}
            setForceTarget={(v) => setForceTarget(prev => ({ ...prev, mayor_succession: v }))}
            onForce={(targetId) => handleForce('mayor_succession', { targetId })}
            onSkip={() => handleSkip('mayor_succession')}
          />
        )}

        {/* Mayor info */}
        {status.maire.player && !status.maire.successionPending && (
          <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-800 pt-2">
            <span className="text-yellow-400 font-medium">Maire :</span>
            <span className="text-white">{status.maire.player.name}</span>
            {status.maire.player.status === 'ghost' && (
              <span className="text-green-400">(fantome)</span>
            )}
          </div>
        )}

        {/* Immunity info */}
        {status.immunite.players.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-800 pt-2">
            <span className="text-cyan-400 font-medium">Immunite :</span>
            {status.immunite.players.map(p => (
              <span key={p.id} className="text-white">{p.name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Power Labels ────────────────────────────────────────────────────────────

const powerLabels = {
  protecteur: 'Protecteur',
  sorciere: 'Sorciere',
  voyante: 'Voyante',
  chasseur: 'Chasseur',
  mayor_succession: 'Succession du Maire',
};

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function ProtecteurPanel({ data, players, loading, forceTarget, setForceTarget, onTrigger, onSkip, onForce }) {
  if (!data.available && !data.pending) {
    return (
      <PowerRow
        label="Protecteur"
        color="text-cyan-400"
        status={data.player ? 'indisponible' : 'aucun joueur'}
        statusColor="text-gray-500"
      />
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-medium text-sm">Protecteur</span>
          {data.player && (
            <span className="text-gray-400 text-xs">({data.player.name})</span>
          )}
        </div>
        <StatusBadge pending={data.pending} />
      </div>

      {!data.pending && (
        <div className="flex gap-2">
          <button
            onClick={onTrigger}
            disabled={!!loading}
            className="px-3 py-1.5 bg-cyan-800 text-white rounded text-xs hover:bg-cyan-700 disabled:opacity-50"
          >
            Activer
          </button>
          <button
            onClick={onSkip}
            disabled={!!loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            Passer
          </button>
        </div>
      )}

      {data.pending && (
        <div className="space-y-2">
          <p className="text-xs text-yellow-400">En attente de la reponse...</p>
          <ForceTargetSelector
            players={players.filter(p => data.player ? p.id !== data.player.id : true).filter(p => p.id !== data.lastProtectedId)}
            value={forceTarget}
            onChange={setForceTarget}
            onForce={() => forceTarget && onForce(forceTarget)}
            loading={loading}
            actionLabel="Forcer protection"
          />
          <button
            onClick={onSkip}
            disabled={!!loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            Passer
          </button>
        </div>
      )}

      {data.lastProtectedId && (
        <p className="text-xs text-gray-500 mt-1">
          Dernier protege : {players.find(p => p.id === data.lastProtectedId)?.name || `#${data.lastProtectedId}`}
        </p>
      )}
    </div>
  );
}

function SorcierePanel({ data, players, loading, forceTarget, setForceTarget, onTrigger, onSkip, onForceResurrect, onForceSkip }) {
  const [victimId, setVictimId] = useState('');

  if (!data.available && !data.pending) {
    return (
      <PowerRow
        label="Sorciere"
        color="text-purple-400"
        status={data.used ? 'pouvoir utilise' : data.player ? 'indisponible' : 'aucun joueur'}
        statusColor="text-gray-500"
      />
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-medium text-sm">Sorciere</span>
          {data.player && (
            <span className="text-gray-400 text-xs">({data.player.name})</span>
          )}
          {data.used && (
            <span className="text-gray-500 text-xs">(utilise)</span>
          )}
        </div>
        <StatusBadge pending={data.pending} />
      </div>

      {!data.pending && !data.used && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={victimId}
              onChange={(e) => setVictimId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded text-white text-xs px-2 py-1.5 flex-1"
            >
              <option value="">Victime des loups...</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => victimId && onTrigger(Number(victimId))}
              disabled={!!loading || !victimId}
              className="px-3 py-1.5 bg-purple-800 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
            >
              Activer
            </button>
          </div>
          <button
            onClick={onSkip}
            disabled={!!loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            Passer
          </button>
        </div>
      )}

      {data.pending && (
        <div className="space-y-2">
          <p className="text-xs text-yellow-400">En attente de la reponse...</p>
          <div className="flex gap-2">
            <button
              onClick={onForceResurrect}
              disabled={!!loading}
              className="px-3 py-1.5 bg-green-800 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
            >
              Forcer resurrection
            </button>
            <button
              onClick={onForceSkip}
              disabled={!!loading}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
            >
              Forcer refus
            </button>
            <button
              onClick={onSkip}
              disabled={!!loading}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
            >
              Passer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoyantePanel({ data, players, loading, forceTarget, setForceTarget, onTrigger, onSkip, onForce }) {
  if (!data.available && !data.pending) {
    return (
      <PowerRow
        label="Voyante"
        color="text-indigo-400"
        status={
          data.moonlessNight ? 'nuit sans lune' :
          data.usesRemaining <= 0 ? 'plus d\'utilisations' :
          data.player ? 'indisponible' : 'aucun joueur'
        }
        statusColor="text-gray-500"
      />
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-medium text-sm">Voyante</span>
          {data.player && (
            <span className="text-gray-400 text-xs">({data.player.name})</span>
          )}
          <span className="text-xs text-gray-500">({data.usesRemaining} restante{data.usesRemaining !== 1 ? 's' : ''})</span>
        </div>
        <StatusBadge pending={data.pending} />
      </div>

      {!data.pending && (
        <div className="flex gap-2">
          <button
            onClick={onTrigger}
            disabled={!!loading}
            className="px-3 py-1.5 bg-indigo-800 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
          >
            Activer
          </button>
          <button
            onClick={onSkip}
            disabled={!!loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            Passer
          </button>
        </div>
      )}

      {data.pending && (
        <div className="space-y-2">
          <p className="text-xs text-yellow-400">En attente de la reponse...</p>
          <ForceTargetSelector
            players={players.filter(p => data.player ? p.id !== data.player.id : true)}
            value={forceTarget}
            onChange={setForceTarget}
            onForce={() => forceTarget && onForce(forceTarget)}
            loading={loading}
            actionLabel="Forcer vision"
          />
          <button
            onClick={onSkip}
            disabled={!!loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            Passer
          </button>
        </div>
      )}
    </div>
  );
}

function ChasseurPanel({ data, players, loading, forceTarget, setForceTarget, onForce, onSkip }) {
  return (
    <div className="border border-red-900 rounded-lg p-3 bg-red-900/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-medium text-sm">Chasseur</span>
          {data.player && (
            <span className="text-gray-400 text-xs">({data.player.name})</span>
          )}
        </div>
        <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-300 animate-pulse">
          En attente
        </span>
      </div>

      <p className="text-xs text-yellow-400 mb-2">Le chasseur a ete elimine ! En attente de son choix...</p>

      <ForceTargetSelector
        players={players}
        value={forceTarget}
        onChange={setForceTarget}
        onForce={() => forceTarget && onForce(forceTarget)}
        loading={loading}
        actionLabel="Forcer tir"
      />
      <button
        onClick={onSkip}
        disabled={!!loading}
        className="mt-2 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
      >
        Passer (ne tire pas)
      </button>
    </div>
  );
}

function MayorSuccessionPanel({ data, players, loading, forceTarget, setForceTarget, onForce, onSkip }) {
  return (
    <div className="border border-yellow-900 rounded-lg p-3 bg-yellow-900/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-medium text-sm">Succession du Maire</span>
          {data.player && (
            <span className="text-gray-400 text-xs">({data.player.name})</span>
          )}
        </div>
        <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/50 text-yellow-300 animate-pulse">
          En attente
        </span>
      </div>

      <p className="text-xs text-yellow-400 mb-2">Le maire a ete elimine ! En attente de son choix de successeur...</p>

      <ForceTargetSelector
        players={players}
        value={forceTarget}
        onChange={setForceTarget}
        onForce={() => forceTarget && onForce(forceTarget)}
        loading={loading}
        actionLabel="Forcer successeur"
      />
      <button
        onClick={onSkip}
        disabled={!!loading}
        className="mt-2 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50"
      >
        Passer (pas de maire)
      </button>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function PowerRow({ label, color, status, statusColor }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={`${color} font-medium`}>{label}</span>
      <span className={`text-xs ${statusColor}`}>{status}</span>
    </div>
  );
}

function StatusBadge({ pending }) {
  if (pending) {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/50 text-yellow-300 animate-pulse">
        En attente
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
      Pret
    </span>
  );
}

function ForceTargetSelector({ players, value, onChange, onForce, loading, actionLabel }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="bg-gray-800 border border-gray-700 rounded text-white text-xs px-2 py-1.5 flex-1"
      >
        <option value="">Choisir un joueur...</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        onClick={onForce}
        disabled={!!loading || !value}
        className="px-3 py-1.5 bg-orange-800 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
      >
        {actionLabel || 'Forcer'}
      </button>
    </div>
  );
}
