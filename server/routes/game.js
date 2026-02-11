import { Router } from 'express';
import { getDb, getSetting } from '../db.js';

const router = Router();

/**
 * GET /api/game/state
 * Returns the public game state: status, current phase, and player list (no tokens).
 */
router.get('/state', (_req, res) => {
  const db = getDb();

  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');

  let currentPhase = null;
  if (currentPhaseId) {
    currentPhase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
  }

  const players = db
    .prepare('SELECT id, name, status, special_role FROM players ORDER BY id')
    .all();

  res.json({
    gameStatus,
    currentPhase,
    players,
  });
});

/**
 * GET /api/game/health
 * Simple health check.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export default router;
