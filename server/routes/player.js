import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../db.js';
import { requirePlayer } from '../middleware/session.js';

const router = Router();

/**
 * POST /api/player/join { name }
 * Creates a new player or reconnects an existing one.
 * Sets a session_token cookie for subsequent requests.
 */
router.post('/join', (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Le prénom est requis.' });
  }

  const cleanName = name.trim();
  const db = getDb();

  // Check if player already exists (reconnection case)
  const existing = db.prepare('SELECT * FROM players WHERE name = ?').get(cleanName);

  if (existing) {
    // Reconnect: generate a fresh session token
    const token = uuidv4();
    db.prepare('UPDATE players SET session_token = ? WHERE id = ?').run(token, existing.id);

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      id: existing.id,
      name: existing.name,
      reconnected: true,
    });
  }

  // New player — only allowed during setup
  const gameStatus = getSetting('game_status');
  if (gameStatus !== 'setup') {
    return res.status(403).json({
      error: 'La partie est déjà en cours. Contactez l\'administrateur.',
    });
  }

  const token = uuidv4();

  const result = db
    .prepare('INSERT INTO players (name, session_token) VALUES (?, ?)')
    .run(cleanName, token);

  res.cookie('session_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    id: result.lastInsertRowid,
    name: cleanName,
    reconnected: false,
  });
});

/**
 * GET /api/player/me
 * Returns the current player's data based on their session.
 */
router.get('/me', requirePlayer, (req, res) => {
  const { session_token, ...player } = req.player;
  res.json(player);
});

export default router;
