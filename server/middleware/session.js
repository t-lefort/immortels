import { getDb } from '../db.js';

/**
 * Player session middleware.
 * Reads `session_token` cookie and attaches the matching player to `req.player`.
 * Also supports `X-Session-Token` header as an override (for multi-tab testing
 * via /play?as=PlayerName — each tab can act as a different player).
 * Does NOT reject if no session — some routes are public.
 */
export function playerSession(req, _res, next) {
  // Header override takes priority (used by ?as= testing feature)
  const token = req.headers['x-session-token'] || req.cookies?.session_token;

  if (token) {
    const player = getDb()
      .prepare('SELECT * FROM players WHERE session_token = ?')
      .get(token);
    if (player) {
      req.player = player;
    }
  }

  next();
}

/**
 * Guard middleware — rejects if no authenticated player session.
 */
export function requirePlayer(req, res, next) {
  if (!req.player) {
    return res.status(401).json({ error: 'Session invalide. Veuillez vous reconnecter.' });
  }
  next();
}
