import { Router } from 'express';
import { getDb, getSetting } from '../db.js';
import { computeVoteCounts } from '../socket-rooms.js';
import { getScoreboard } from '../game-engine.js';

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
    .prepare('SELECT id, name, status, role, special_role FROM players ORDER BY id')
    .all();

  let voteCount, totalExpected;
  if (currentPhase && (currentPhase.status === 'voting' || currentPhase.status === 'active')) {
    ({ voteCount, totalExpected } = computeVoteCounts(currentPhase.id, currentPhase.type));
  }

  res.json({
    gameStatus,
    currentPhase,
    players,
    voteCount,
    totalExpected,
  });
});

/**
 * GET /api/game/phase/:id
 * Returns phase details for a player (public info only).
 */
router.get('/phase/:id', (req, res) => {
  const db = getDb();
  const phaseId = Number(req.params.id);

  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseId);
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable.' });
  }

  // Get eliminated players for this phase (public info)
  const victims = db.prepare(`
    SELECT pv.player_id, p.name, p.role, pv.eliminated_by
    FROM phase_victims pv
    JOIN players p ON pv.player_id = p.id
    WHERE pv.phase_id = ? AND pv.was_resurrected = 0
  `).all(phaseId);

  res.json({ phase, victims });
});

/**
 * GET /api/game/scoreboard
 * Returns the final scoreboard once the game is finished.
 */
router.get('/scoreboard', (_req, res) => {
  const gameStatus = getSetting('game_status');
  if (gameStatus !== 'finished') {
    return res.status(403).json({ error: 'Scores non disponibles avant la fin de la partie.' });
  }
  const winner = getSetting('game_winner') || null;
  res.json({ scoreboard: getScoreboard(), winner });
});

/**
 * GET /api/game/health
 * Health check endpoint for Docker healthcheck and monitoring.
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
