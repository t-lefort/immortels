import { getDb, getSetting, getAllSettings } from './db.js';
import {
  joinPlayerRooms,
  emitToAdmin,
  emitToDashboard,
  computeVoteCounts,
} from './socket-rooms.js';
import logger from './logger.js';

/**
 * Register all Socket.IO event handlers.
 *
 * Connection flow:
 * 1. Client connects (generic socket.io connection)
 * 2. Client identifies itself via one of:
 *    - player:join  { sessionToken }
 *    - admin:join   { password }
 *    - dashboard:join {}
 * 3. Server joins client to appropriate rooms and sends state:sync
 *
 * On reconnection the same flow applies — state:sync rebuilds
 * everything from SQLite so no in-memory state is lost on server restart.
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.socket('Client connected', { socketId: socket.id });

    // ─── Player join ──────────────────────────────────────────────────────────
    socket.on('player:join', ({ sessionToken }) => {
      if (!sessionToken) return;

      const db = getDb();
      const player = db
        .prepare('SELECT * FROM players WHERE session_token = ?')
        .get(sessionToken);

      if (!player) return;

      // Store player info on the socket for later use
      socket.playerId = player.id;
      socket.playerName = player.name;
      socket.clientType = 'player';

      // Join personal + role rooms
      joinPlayerRooms(socket, player);

      logger.socket('Player joined rooms', { playerId: player.id, playerName: player.name });

      // Send full state sync to this player
      sendPlayerStateSync(socket, player);

      // Notify admin & dashboard of lobby update
      const lobbyData = buildLobbyUpdate();
      emitToAdmin(io, 'lobby:update', lobbyData);
      emitToDashboard(io, 'lobby:update', lobbyData);
    });

    // ─── Admin join ───────────────────────────────────────────────────────────
    socket.on('admin:join', ({ password }) => {
      const expected = getSetting('admin_password');
      if (password !== expected) return;

      socket.join('admin');
      socket.clientType = 'admin';
      logger.socket('Admin connected', { socketId: socket.id });

      // Send full admin state sync
      sendAdminStateSync(socket);
    });

    // ─── Dashboard join ───────────────────────────────────────────────────────
    socket.on('dashboard:join', () => {
      socket.join('dashboard');
      socket.clientType = 'dashboard';
      logger.socket('Dashboard connected', { socketId: socket.id });

      // Send full dashboard state sync
      sendDashboardStateSync(socket);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.socket('Client disconnected', {
        socketId: socket.id,
        playerId: socket.playerId || null,
        playerName: socket.playerName || null,
        clientType: socket.clientType || null,
      });
    });
  });
}

// ─── State sync builders ──────────────────────────────────────────────────────

/**
 * Build and send a full state:sync to a player socket.
 * Tailored to the player's role, status, and current game state.
 * All data is rebuilt from SQLite — survives server restart.
 */
function sendPlayerStateSync(socket, player) {
  const db = getDb();
  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');

  let currentPhase = null;
  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
  }

  // Check if this player has already voted in the current phase (per vote type)
  const hasVoted = {};
  if (currentPhase) {
    const votes = db
      .prepare('SELECT vote_type FROM votes WHERE phase_id = ? AND voter_id = ?')
      .all(currentPhase.id, player.id);
    for (const v of votes) {
      hasVoted[v.vote_type] = true;
    }

    // Check ghost identifications
    if (player.status === 'ghost') {
      const ghostIdent = db
        .prepare('SELECT id FROM ghost_identifications WHERE phase_id = ? AND ghost_id = ?')
        .get(currentPhase.id, player.id);
      if (ghostIdent) {
        hasVoted.ghost_identify = true;
      }
    }
  }

  // Public player list (no tokens; roles only revealed for ghost/eliminated players)
  const players = db
    .prepare('SELECT id, name, status, role, special_role FROM players ORDER BY id')
    .all()
    .map(p => {
      if (p.status === 'ghost') {
        return { id: p.id, name: p.name, status: p.status, role: p.role, special_role: p.special_role };
      }
      return { id: p.id, name: p.name, status: p.status };
    });

  // Vote counts for current phase
  let voteCount = 0;
  let totalExpected = 0;
  if (currentPhase && (currentPhase.status === 'voting' || currentPhase.status === 'completed')) {
    const counts = computeVoteCounts(currentPhase.id, currentPhase.type);
    voteCount = counts.voteCount;
    totalExpected = counts.totalExpected;
  }

  // Timer state: if there's an active timer, we store it in settings
  const timerDuration = getSetting('timer_duration');
  const timerStartedAt = getSetting('timer_started_at');
  let timerState = null;
  if (timerDuration && timerStartedAt) {
    const elapsed = Math.floor((Date.now() - Number(timerStartedAt)) / 1000);
    const remaining = Math.max(0, Number(timerDuration) - elapsed);
    if (remaining > 0) {
      timerState = { duration: Number(timerDuration), remaining };
    }
  }

  // Wolf list (only if this player is a wolf and game has started)
  let wolves = null;
  if (player.role === 'wolf' && gameStatus !== 'setup') {
    wolves = db
      .prepare("SELECT id, name FROM players WHERE role = 'wolf' ORDER BY name")
      .all();
  }

  socket.emit('state:sync', {
    gameStatus,
    currentPhase,
    player: {
      id: player.id,
      name: player.name,
      role: player.role,
      specialRole: player.special_role,
      status: player.status,
      score: player.score,
    },
    hasVoted,
    voteCount,
    totalExpected,
    players,
    timerState,
    wolves,
  });
}

/**
 * Build and send a full state:sync to an admin socket.
 * Admin gets everything: all players (with roles), all votes, full phase data.
 */
function sendAdminStateSync(socket) {
  const db = getDb();
  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');
  const settings = getAllSettings();

  const players = db.prepare('SELECT * FROM players ORDER BY id').all();

  let currentPhase = null;
  let votes = [];
  let voteCount = 0;
  let totalExpected = 0;

  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));

    if (currentPhase) {
      votes = db.prepare('SELECT * FROM votes WHERE phase_id = ? ORDER BY id').all(currentPhase.id);
      const counts = computeVoteCounts(currentPhase.id, currentPhase.type);
      voteCount = counts.voteCount;
      totalExpected = counts.totalExpected;
    }
  }

  const phases = db.prepare('SELECT * FROM phases ORDER BY id DESC LIMIT 20').all();
  const challenges = db.prepare('SELECT * FROM challenges ORDER BY id DESC').all();

  socket.emit('state:sync', {
    gameStatus,
    currentPhase,
    players,
    settings,
    votes,
    voteCount,
    totalExpected,
    phases,
    challenges,
  });
}

/**
 * Build and send a full state:sync to a dashboard socket.
 * Dashboard gets public game state: players (no tokens), phase, vote progress.
 */
function sendDashboardStateSync(socket) {
  const db = getDb();
  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');

  let currentPhase = null;
  let voteCount = 0;
  let totalExpected = 0;

  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));

    if (currentPhase && (currentPhase.status === 'voting' || currentPhase.status === 'completed')) {
      const counts = computeVoteCounts(currentPhase.id, currentPhase.type);
      voteCount = counts.voteCount;
      totalExpected = counts.totalExpected;
    }
  }

  // Public player list (id, name, status, role, special_role — no tokens)
  const players = db
    .prepare('SELECT id, name, status, role, special_role FROM players ORDER BY id')
    .all();

  const playerCount = players.length;

  // Timer state
  const timerDuration = getSetting('timer_duration');
  const timerStartedAt = getSetting('timer_started_at');
  let timerState = null;
  if (timerDuration && timerStartedAt) {
    const elapsed = Math.floor((Date.now() - Number(timerStartedAt)) / 1000);
    const remaining = Math.max(0, Number(timerDuration) - elapsed);
    if (remaining > 0) {
      timerState = { duration: Number(timerDuration), remaining };
    }
  }

  socket.emit('state:sync', {
    gameStatus,
    currentPhase,
    players,
    playerCount,
    voteCount,
    totalExpected,
    timerState,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a lobby:update payload.
 */
function buildLobbyUpdate() {
  const db = getDb();
  const players = db.prepare('SELECT id, name FROM players ORDER BY id').all();
  return {
    playerCount: players.length,
    players,
  };
}

/**
 * Force a full state re-sync for a specific player by ID.
 * Useful after admin overrides that change player data.
 */
export function resyncPlayer(io, playerId) {
  const db = getDb();
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) return;

  const room = `player:${playerId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  if (!sockets) return;

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      sendPlayerStateSync(socket, player);
    }
  }
}

/**
 * Force a full state re-sync for all admin sockets.
 */
export function resyncAdmin(io) {
  const room = io.sockets.adapter.rooms.get('admin');
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      sendAdminStateSync(socket);
    }
  }
}

/**
 * Force a full state re-sync for all dashboard sockets.
 */
export function resyncDashboard(io) {
  const room = io.sockets.adapter.rooms.get('dashboard');
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      sendDashboardStateSync(socket);
    }
  }
}
