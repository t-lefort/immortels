import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../db.js';
import { requirePlayer } from '../middleware/session.js';
import {
  submitVote,
  submitGhostIdentifications,
  getCurrentPhase,
} from '../game-engine.js';

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
      httpOnly: false, // readable by JS for socket auth
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
    httpOnly: false, // readable by JS for socket auth
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Notify lobby update
  const io = req.app.get('io');
  if (io) {
    io.to('admin').emit('lobby:update', {
      playerCount: db.prepare('SELECT COUNT(*) as count FROM players').get().count,
    });
  }

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

  // Include game state context
  const gameStatus = getSetting('game_status');
  const currentPhaseId = getSetting('current_phase_id');

  let currentPhase = null;
  if (currentPhaseId) {
    currentPhase = getDb().prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId));
  }

  // Check if player has already voted in current phase
  let hasVoted = {};
  if (currentPhase) {
    const db = getDb();
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

  res.json({
    ...player,
    gameStatus,
    currentPhase,
    hasVoted,
  });
});

/**
 * POST /api/player/vote { targetId }
 * Submit a vote (wolf vote during night, or village council vote).
 * Vote type is determined by the player's role and the current phase type.
 */
router.post('/vote', requirePlayer, (req, res) => {
  const { targetId } = req.body;
  const player = req.player;

  if (!targetId) {
    return res.status(400).json({ error: 'targetId est requis.' });
  }

  const currentPhase = getCurrentPhase();
  if (!currentPhase) {
    return res.status(400).json({ error: 'Aucune phase en cours.' });
  }

  if (currentPhase.status !== 'voting') {
    return res.status(400).json({ error: 'Le vote n\'est pas encore ouvert.' });
  }

  // Determine vote type from player role + phase type
  let voteType;
  if (currentPhase.type === 'night') {
    if (player.status === 'ghost') {
      voteType = 'ghost_eliminate';
    } else if (player.role === 'wolf') {
      voteType = 'wolf';
    } else {
      // Villagers don't vote during night (they guess instead)
      return res.status(400).json({ error: 'Les villageois utilisent le vote devinette la nuit.' });
    }
  } else if (currentPhase.type === 'village_council') {
    if (player.status !== 'alive') {
      return res.status(400).json({ error: 'Les fantômes ne votent pas au conseil.' });
    }
    voteType = 'village';
  } else {
    return res.status(400).json({ error: 'Type de phase invalide.' });
  }

  try {
    const vote = submitVote(currentPhase.id, player.id, Number(targetId), voteType);

    if (!vote) {
      return res.status(400).json({ error: 'Vous avez déjà voté.' });
    }

    // Emit vote update with counts
    emitVoteUpdate(req.app.get('io'), currentPhase);

    res.json({ success: true, voteType });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/player/villager-guess { targetId }
 * Submit a villager guess during night phase.
 */
router.post('/villager-guess', requirePlayer, (req, res) => {
  const { targetId } = req.body;
  const player = req.player;

  if (!targetId) {
    return res.status(400).json({ error: 'targetId est requis.' });
  }

  const currentPhase = getCurrentPhase();
  if (!currentPhase) {
    return res.status(400).json({ error: 'Aucune phase en cours.' });
  }

  if (currentPhase.type !== 'night') {
    return res.status(400).json({ error: 'La devinette villageois n\'est disponible que la nuit.' });
  }

  if (currentPhase.status !== 'voting') {
    return res.status(400).json({ error: 'Le vote n\'est pas encore ouvert.' });
  }

  if (player.status !== 'alive') {
    return res.status(400).json({ error: 'Les fantômes ne font pas de devinette villageois.' });
  }

  try {
    const vote = submitVote(currentPhase.id, player.id, Number(targetId), 'villager_guess');

    if (!vote) {
      return res.status(400).json({ error: 'Vous avez déjà fait votre devinette.' });
    }

    // Emit vote update with counts
    emitVoteUpdate(req.app.get('io'), currentPhase);

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/player/ghost-identify { targetIds: [id1, id2, ...] }
 * Submit ghost identifications (villager ghosts identify suspected wolves).
 */
router.post('/ghost-identify', requirePlayer, (req, res) => {
  const { targetIds } = req.body;
  const player = req.player;

  if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    return res.status(400).json({ error: 'targetIds (tableau) est requis.' });
  }

  if (player.status !== 'ghost') {
    return res.status(400).json({ error: 'Seuls les fantômes peuvent identifier.' });
  }

  if (player.role !== 'villager') {
    return res.status(400).json({ error: 'Seuls les fantômes villageois peuvent identifier les loups.' });
  }

  const currentPhase = getCurrentPhase();
  if (!currentPhase) {
    return res.status(400).json({ error: 'Aucune phase en cours.' });
  }

  if (currentPhase.type !== 'night') {
    return res.status(400).json({ error: 'L\'identification n\'est disponible que la nuit.' });
  }

  if (currentPhase.status !== 'voting') {
    return res.status(400).json({ error: 'Le vote n\'est pas encore ouvert.' });
  }

  try {
    const identifications = submitGhostIdentifications(
      currentPhase.id,
      player.id,
      targetIds.map(Number)
    );

    res.json({ success: true, identifications });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/player/wolves
 * Wolves-only endpoint: returns the list of wolf player names/ids.
 * Only available after the game has started.
 */
router.get('/wolves', requirePlayer, (req, res) => {
  const player = req.player;

  if (player.role !== 'wolf') {
    return res.status(403).json({ error: 'Accès réservé aux loups.' });
  }

  const gameStatus = getSetting('game_status');
  if (gameStatus === 'setup') {
    return res.status(400).json({ error: 'La partie n\'a pas encore commencé.' });
  }

  const wolves = getDb()
    .prepare("SELECT id, name, status FROM players WHERE role = 'wolf' ORDER BY name")
    .all();

  res.json({ wolves });
});

/**
 * Emit a phase:vote_update event with current vote counts.
 * Counts combine wolf + villager_guess for night (shared counter),
 * or village for council.
 */
function emitVoteUpdate(io, currentPhase) {
  if (!io || !currentPhase) return;

  const db = getDb();

  let voteCount = 0;
  let totalExpected = 0;

  if (currentPhase.type === 'night') {
    // Combined wolf + villager_guess votes (alive players)
    voteCount = db
      .prepare(
        "SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE phase_id = ? AND vote_type IN ('wolf', 'villager_guess')"
      )
      .get(currentPhase.id).count;
    totalExpected = db
      .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
      .get().count;
  } else {
    // Village council votes
    voteCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM votes WHERE phase_id = ? AND vote_type = 'village'"
      )
      .get(currentPhase.id).count;
    totalExpected = db
      .prepare("SELECT COUNT(*) as count FROM players WHERE status = 'alive'")
      .get().count;
  }

  io.emit('phase:vote_update', {
    phaseId: currentPhase.id,
    voteCount,
    totalExpected,
  });
}

export default router;
