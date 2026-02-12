import { getDb, getSetting, getAllSettings } from './db.js';

/**
 * State Recovery Module
 *
 * Reconstructs complete game state from SQLite alone on server startup.
 * Ensures that a server restart mid-phase works correctly:
 * - Recovers current phase, pending special powers, timer state
 * - Provides all info needed for Socket.IO rooms to be set up when clients reconnect
 *
 * This module does NOT set up Socket.IO rooms directly (those are created when
 * clients reconnect and emit player:join / admin:join / dashboard:join).
 * It only validates and logs the recovered state.
 */

/**
 * Main recovery function — called at server startup.
 * Reads all game state from SQLite and logs a summary.
 * Returns the recovered state object for inspection.
 */
export function recoverState() {
  const db = getDb();
  const settings = getAllSettings();

  const gameStatus = settings.game_status || 'setup';
  const currentPhaseId = settings.current_phase_id
    ? Number(settings.current_phase_id)
    : null;

  console.log(`[RECOVERY] Game status: ${gameStatus}`);

  // ─── Players ─────────────────────────────────────────────────────────────
  const players = db.prepare('SELECT * FROM players ORDER BY id').all();
  const alivePlayers = players.filter(p => p.status === 'alive');
  const ghostPlayers = players.filter(p => p.status === 'ghost');
  const wolves = players.filter(p => p.role === 'wolf');
  const villagers = players.filter(p => p.role === 'villager');

  console.log(
    `[RECOVERY] Players: ${players.length} total, ` +
    `${alivePlayers.length} alive, ${ghostPlayers.length} ghosts, ` +
    `${wolves.length} wolves, ${villagers.length} villagers`
  );

  // ─── Current phase ────────────────────────────────────────────────────────
  let currentPhase = null;
  let pendingVotes = [];

  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(currentPhaseId);

    if (currentPhase) {
      console.log(
        `[RECOVERY] Active phase: #${currentPhase.id} ` +
        `(${currentPhase.type}, status: ${currentPhase.status})`
      );

      // Recover votes for this phase
      pendingVotes = db.prepare(
        'SELECT * FROM votes WHERE phase_id = ?'
      ).all(currentPhaseId);

      console.log(`[RECOVERY] Votes in current phase: ${pendingVotes.length}`);

      // Recover ghost identifications
      const ghostIdents = db.prepare(
        'SELECT * FROM ghost_identifications WHERE phase_id = ?'
      ).all(currentPhaseId);

      if (ghostIdents.length > 0) {
        console.log(`[RECOVERY] Ghost identifications in current phase: ${ghostIdents.length}`);
      }
    } else {
      // Phase ID in settings but phase doesn't exist — clean up
      console.warn(
        `[RECOVERY] current_phase_id=${currentPhaseId} references a non-existent phase. Clearing.`
      );
      db.prepare("UPDATE game_settings SET value = NULL WHERE key = 'current_phase_id'").run();
    }
  } else {
    console.log('[RECOVERY] No active phase.');
  }

  // ─── Pending special powers ──────────────────────────────────────────────
  const pendingPowers = [];

  if (settings.protecteur_pending === '1') {
    const protector = db.prepare(
      "SELECT id, name FROM players WHERE special_role = 'protecteur' AND status = 'alive'"
    ).get();
    pendingPowers.push({
      power: 'protecteur',
      player: protector || null,
    });
    console.log(
      `[RECOVERY] Pending: protecteur (${protector ? protector.name : 'player not found'})`
    );
  }

  if (settings.sorciere_pending === '1') {
    const witch = db.prepare(
      "SELECT id, name FROM players WHERE special_role = 'sorciere' AND status = 'alive'"
    ).get();
    const victimId = settings.sorciere_victim_id
      ? Number(settings.sorciere_victim_id)
      : null;
    pendingPowers.push({
      power: 'sorciere',
      player: witch || null,
      victimId,
    });
    console.log(
      `[RECOVERY] Pending: sorciere (${witch ? witch.name : 'player not found'}, victim: ${victimId})`
    );
  }

  if (settings.voyante_pending === '1') {
    const seer = db.prepare(
      "SELECT id, name FROM players WHERE special_role = 'voyante' AND status = 'alive'"
    ).get();
    pendingPowers.push({
      power: 'voyante',
      player: seer || null,
      usesRemaining: Number(settings.seer_uses_remaining || '0'),
    });
    console.log(
      `[RECOVERY] Pending: voyante (${seer ? seer.name : 'player not found'}, uses: ${settings.seer_uses_remaining})`
    );
  }

  if (settings.hunter_pending === '1') {
    const hunterId = settings.hunter_player_id
      ? Number(settings.hunter_player_id)
      : null;
    const hunter = hunterId
      ? db.prepare('SELECT id, name FROM players WHERE id = ?').get(hunterId)
      : null;
    pendingPowers.push({
      power: 'chasseur',
      player: hunter || null,
    });
    console.log(
      `[RECOVERY] Pending: chasseur (${hunter ? hunter.name : 'player not found'})`
    );
  }

  if (settings.mayor_succession_pending === '1') {
    const mayorId = settings.mayor_id ? Number(settings.mayor_id) : null;
    const mayor = mayorId
      ? db.prepare('SELECT id, name FROM players WHERE id = ?').get(mayorId)
      : null;
    pendingPowers.push({
      power: 'mayor_succession',
      player: mayor || null,
    });
    console.log(
      `[RECOVERY] Pending: mayor_succession (${mayor ? mayor.name : 'unknown'})`
    );
  }

  // ─── Timer state ─────────────────────────────────────────────────────────
  let timerState = null;
  const timerDuration = settings.timer_duration
    ? Number(settings.timer_duration)
    : null;
  const timerStartedAt = settings.timer_started_at
    ? Number(settings.timer_started_at)
    : null;

  if (timerDuration && timerStartedAt) {
    const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
    const remaining = Math.max(0, timerDuration - elapsed);
    if (remaining > 0) {
      timerState = { duration: timerDuration, remaining, startedAt: timerStartedAt };
      console.log(`[RECOVERY] Active timer: ${remaining}s remaining of ${timerDuration}s`);
    } else {
      console.log('[RECOVERY] Timer expired (cleaning up).');
      // Clear expired timer from settings
      db.prepare("UPDATE game_settings SET value = NULL WHERE key = 'timer_duration'").run();
      db.prepare("UPDATE game_settings SET value = NULL WHERE key = 'timer_started_at'").run();
    }
  }

  // ─── Mayor info ──────────────────────────────────────────────────────────
  const mayorId = settings.mayor_id ? Number(settings.mayor_id) : null;
  let mayor = null;
  if (mayorId) {
    mayor = db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(mayorId);
    console.log(`[RECOVERY] Mayor: ${mayor ? mayor.name : 'not found'} (status: ${mayor?.status})`);
  }

  // ─── Protection state ────────────────────────────────────────────────────
  const protectedPlayerId = settings.protected_player_id
    ? Number(settings.protected_player_id)
    : null;
  const lastProtectedPlayerId = settings.last_protected_player_id
    ? Number(settings.last_protected_player_id)
    : null;

  if (protectedPlayerId) {
    const protectedPlayer = db.prepare('SELECT name FROM players WHERE id = ?').get(protectedPlayerId);
    console.log(`[RECOVERY] Protected player: ${protectedPlayer?.name || 'unknown'}`);
  }

  // ─── Room info (for logging — actual rooms are created on client reconnect) ──
  const playersWithSessions = players.filter(p => p.session_token);
  console.log(
    `[RECOVERY] Players with active sessions: ${playersWithSessions.length}/${players.length}`
  );
  console.log(
    `[RECOVERY] Room setup will occur when clients reconnect via Socket.IO.`
  );

  // ─── Summary ─────────────────────────────────────────────────────────────
  const state = {
    gameStatus,
    currentPhase,
    pendingVotes,
    pendingPowers,
    timerState,
    mayor,
    protectedPlayerId,
    lastProtectedPlayerId,
    players: {
      total: players.length,
      alive: alivePlayers.length,
      ghosts: ghostPlayers.length,
      wolves: wolves.length,
      villagers: villagers.length,
      withSessions: playersWithSessions.length,
    },
  };

  console.log('[RECOVERY] State recovery complete.');
  return state;
}
