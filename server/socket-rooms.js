import { getDb } from './db.js';

/**
 * Socket.IO room management utilities.
 *
 * Room naming conventions:
 *   player:{id}  — personal room for a specific player
 *   wolves       — all wolf players
 *   ghosts       — all ghost (eliminated) players
 *   admin        — admin client(s)
 *   dashboard    — dashboard display client(s)
 */

/**
 * Join a player socket to all appropriate rooms based on their current state.
 * - Always joins `player:{id}`
 * - Joins `wolves` if role is wolf
 * - Joins `ghosts` if status is ghost
 */
export function joinPlayerRooms(socket, player) {
  socket.join(`player:${player.id}`);

  if (player.role === 'wolf') {
    socket.join('wolves');
  }

  if (player.status === 'ghost') {
    socket.join('ghosts');
  }
}

/**
 * Find the first connected socket for a given player ID.
 * Returns the socket instance or null if not connected.
 */
export function getPlayerSocket(io, playerId) {
  const room = `player:${playerId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  if (!sockets || sockets.size === 0) return null;

  const socketId = sockets.values().next().value;
  return io.sockets.sockets.get(socketId) || null;
}

/**
 * Emit an event to a specific player's personal room.
 */
export function emitToPlayer(io, playerId, event, data) {
  io.to(`player:${playerId}`).emit(event, data);
}

/**
 * Emit an event to all wolf players.
 */
export function emitToWolves(io, event, data) {
  io.to('wolves').emit(event, data);
}

/**
 * Emit an event to all ghost players.
 */
export function emitToGhosts(io, event, data) {
  io.to('ghosts').emit(event, data);
}

/**
 * Emit an event to all connected clients.
 */
export function emitToAll(io, event, data) {
  io.emit(event, data);
}

/**
 * Emit an event to all connected clients except those in a specific room.
 */
export function emitToAllExcept(io, event, data, excludeRoom) {
  io.except(excludeRoom).emit(event, data);
}

/**
 * Emit an event to the dashboard room.
 */
export function emitToDashboard(io, event, data) {
  io.to('dashboard').emit(event, data);
}

/**
 * Emit an event to the admin room.
 */
export function emitToAdmin(io, event, data) {
  io.to('admin').emit(event, data);
}

/**
 * Update a player's room memberships when their status changes.
 * When a player becomes a ghost:
 *   - join the ghosts room
 * When a player is resurrected (back to alive):
 *   - leave the ghosts room
 *
 * This updates ALL sockets associated with that player (in case of multiple tabs).
 */
export function updatePlayerRooms(io, playerId, newStatus) {
  const room = `player:${playerId}`;
  const playerSockets = io.sockets.adapter.rooms.get(room);
  if (!playerSockets) return;

  for (const socketId of playerSockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    if (newStatus === 'ghost') {
      socket.join('ghosts');
    } else if (newStatus === 'alive') {
      socket.leave('ghosts');
    }
  }
}

/**
 * Compute the combined vote count for a phase.
 * For night phases: wolf + villager_guess votes (combined public counter).
 * For village_council phases: village votes.
 * Returns { voteCount, totalExpected }.
 */
export function computeVoteCounts(phaseId, phaseType) {
  const db = getDb();

  let voteCount = 0;
  let totalExpected = 0;

  if (phaseType === 'night') {
    // Combined wolf + villager_guess — one vote per voter counts
    // Use DISTINCT voter_id since a wolf votes as wolf and a villager votes as villager_guess
    voteCount = db
      .prepare(
        "SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE phase_id = ? AND vote_type IN ('wolf', 'villager_guess')"
      )
      .get(phaseId).count;
    totalExpected = db
      .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
      .get().count;
  } else {
    // Village council votes
    voteCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM votes WHERE phase_id = ? AND vote_type = 'village'"
      )
      .get(phaseId).count;
    totalExpected = db
      .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
      .get().count;
  }

  return { voteCount, totalExpected };
}
