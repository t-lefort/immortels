/**
 * Structured logging module for Les Immortels.
 *
 * Categories: VOTE, PHASE, SOCKET, AUTH, SCORE, SPECIAL, GAME, ERROR
 * Format: JSON lines with timestamp, category, message, optional data
 */

const log = (category, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    category,
    message,
    ...data,
  }));
};

export default {
  vote: (msg, data) => log('VOTE', msg, data),
  phase: (msg, data) => log('PHASE', msg, data),
  socket: (msg, data) => log('SOCKET', msg, data),
  auth: (msg, data) => log('AUTH', msg, data),
  score: (msg, data) => log('SCORE', msg, data),
  special: (msg, data) => log('SPECIAL', msg, data),
  game: (msg, data) => log('GAME', msg, data),
  error: (msg, data) => log('ERROR', msg, data),
};
