import { getDb, getSetting } from './db.js';

/**
 * Register Socket.IO event handlers.
 * Manages rooms: player:{id}, wolves, ghosts, admin, dashboard
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // ─── Player join ──────────────────────────────────────────────────────────
    socket.on('player:join', ({ sessionToken }) => {
      if (!sessionToken) return;

      const player = getDb()
        .prepare('SELECT * FROM players WHERE session_token = ?')
        .get(sessionToken);

      if (!player) return;

      // Store player info on the socket for later use
      socket.playerId = player.id;
      socket.playerName = player.name;

      // Join personal room
      socket.join(`player:${player.id}`);

      // Join role-based rooms
      if (player.role === 'wolf') {
        socket.join('wolves');
      }
      if (player.status === 'ghost') {
        socket.join('ghosts');
      }

      console.log(`[SOCKET] Player "${player.name}" (id:${player.id}) joined rooms`);

      // Send state sync to this player
      sendStateSync(socket, player);

      // Notify admin of lobby update
      io.to('admin').emit('lobby:update', {
        playerCount: getDb().prepare('SELECT COUNT(*) as count FROM players').get().count,
      });
    });

    // ─── Admin join ───────────────────────────────────────────────────────────
    socket.on('admin:join', ({ password }) => {
      const expected = getSetting('admin_password');
      if (password !== expected) return;

      socket.join('admin');
      console.log(`[SOCKET] Admin connected: ${socket.id}`);

      // Send current game state to admin
      const players = getDb().prepare('SELECT * FROM players ORDER BY id').all();
      const gameStatus = getSetting('game_status');
      const currentPhaseId = getSetting('current_phase_id');

      let currentPhase = null;
      if (currentPhaseId) {
        currentPhase = getDb().prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
      }

      socket.emit('state:sync', {
        gameStatus,
        currentPhase,
        players,
      });
    });

    // ─── Dashboard join ───────────────────────────────────────────────────────
    socket.on('dashboard:join', () => {
      socket.join('dashboard');
      console.log(`[SOCKET] Dashboard connected: ${socket.id}`);

      // Send current state
      const gameStatus = getSetting('game_status');
      const currentPhaseId = getSetting('current_phase_id');

      let currentPhase = null;
      if (currentPhaseId) {
        currentPhase = getDb().prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
      }

      const players = getDb()
        .prepare('SELECT id, name, status, special_role FROM players ORDER BY id')
        .all();

      socket.emit('state:sync', {
        gameStatus,
        currentPhase,
        players,
      });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const label = socket.playerName
        ? `"${socket.playerName}" (id:${socket.playerId})`
        : socket.id;
      console.log(`[SOCKET] Disconnected: ${label}`);
    });
  });
}

/**
 * Send full state sync to a specific player socket.
 */
function sendStateSync(socket, player) {
  const db = getDb();
  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');

  let currentPhase = null;
  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
  }

  // Check if this player has already voted in the current phase
  let hasVoted = false;
  if (currentPhase) {
    const vote = db
      .prepare('SELECT id FROM votes WHERE phase_id = ? AND voter_id = ?')
      .get(currentPhase.id, player.id);
    hasVoted = !!vote;
  }

  // Public player list (no tokens, no roles for non-wolves)
  const players = db
    .prepare('SELECT id, name, status FROM players ORDER BY id')
    .all();

  // Vote counts for current phase (combined wolf + villager_guess for night)
  let voteCount = 0;
  let totalExpected = 0;
  if (currentPhase && currentPhase.status === 'voting') {
    if (currentPhase.type === 'night') {
      voteCount = db
        .prepare("SELECT COUNT(*) as count FROM votes WHERE phase_id = ? AND vote_type IN ('wolf', 'villager_guess')")
        .get(currentPhase.id).count;
      totalExpected = db
        .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
        .get().count;
    } else {
      voteCount = db
        .prepare("SELECT COUNT(*) as count FROM votes WHERE phase_id = ? AND vote_type = 'village'")
        .get(currentPhase.id).count;
      totalExpected = db
        .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
        .get().count;
    }
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
  });
}
