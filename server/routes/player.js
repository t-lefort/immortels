import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../db.js';
import { requirePlayer } from '../middleware/session.js';
import {
  submitVote,
  submitGhostIdentifications,
  getCurrentPhase,
} from '../game-engine.js';
import {
  emitToAll,
  computeVoteCounts,
} from '../socket-rooms.js';
import {
  processProtecteurResponse,
  processSorciereResponse,
  processVoyanteResponse,
  processChasseurResponse,
  processMayorSuccession,
} from '../special-roles.js';

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

  if (cleanName.length > 50) {
    return res.status(400).json({ error: 'Le prénom ne peut pas dépasser 50 caractères.' });
  }

  if (cleanName.length < 1) {
    return res.status(400).json({ error: 'Le prénom est requis.' });
  }

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

  // Notify lobby update to admin and dashboard
  const io = req.app.get('io');
  if (io) {
    const players = db.prepare('SELECT id, name FROM players ORDER BY id').all();
    const lobbyData = { playerCount: players.length, players };
    io.to('admin').emit('lobby:update', lobbyData);
    io.to('dashboard').emit('lobby:update', lobbyData);
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

  // Score is hidden from players until the game is finished
  const responsePlayer = { ...player };
  if (gameStatus !== 'finished') {
    delete responsePlayer.score;
  }

  res.json({
    ...responsePlayer,
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

  // Validate target exists
  const db = getDb();
  const target = db.prepare('SELECT id, name, role, status FROM players WHERE id = ?').get(Number(targetId));
  if (!target) {
    return res.status(400).json({ error: 'Joueur cible introuvable.' });
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
      // Ghosts vote to eliminate alive players
      if (target.status !== 'alive') {
        return res.status(400).json({ error: 'Vous ne pouvez voter que pour un joueur vivant.' });
      }
    } else if (player.role === 'wolf') {
      voteType = 'wolf';
      // Wolf can't vote for wolf
      if (target.role === 'wolf') {
        return res.status(400).json({ error: 'Vous ne pouvez pas voter pour un autre loup.' });
      }
      // Wolf must be alive to vote
      if (player.status !== 'alive') {
        return res.status(400).json({ error: 'Les loups fantômes ne votent pas comme loups.' });
      }
      // Target must be alive
      if (target.status !== 'alive') {
        return res.status(400).json({ error: 'Vous ne pouvez voter que pour un joueur vivant.' });
      }
    } else {
      // Villagers don't vote during night (they guess instead)
      return res.status(400).json({ error: 'Les villageois utilisent le vote devinette la nuit.' });
    }
  } else if (currentPhase.type === 'village_council') {
    if (player.status !== 'alive') {
      return res.status(400).json({ error: 'Les fantômes ne votent pas au conseil.' });
    }
    // Target must be alive for village council
    if (target.status !== 'alive') {
      return res.status(400).json({ error: 'Vous ne pouvez voter que pour un joueur vivant.' });
    }
    voteType = 'village';
  } else {
    return res.status(400).json({ error: 'Type de phase invalide.' });
  }

  try {
    const vote = submitVote(currentPhase.id, player.id, Number(targetId), voteType);

    // Emit vote update with counts
    emitVoteUpdate(req.app.get('io'), currentPhase);

    res.json({ success: true, voteType, updated: !!vote.updated });
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

  // Validate target exists
  const db = getDb();
  const target = db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(Number(targetId));
  if (!target) {
    return res.status(400).json({ error: 'Joueur cible introuvable.' });
  }

  // Target must be alive
  if (target.status !== 'alive') {
    return res.status(400).json({ error: 'Le joueur cible doit être vivant.' });
  }

  // Can't guess yourself
  if (Number(targetId) === player.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas vous choisir vous-même.' });
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

    // Emit vote update with counts
    emitVoteUpdate(req.app.get('io'), currentPhase);

    res.json({ success: true, updated: !!vote.updated });
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

  // Validate all targets exist and are alive
  const db = getDb();
  const numericTargetIds = targetIds.map(Number);
  for (const tid of numericTargetIds) {
    const target = db.prepare('SELECT id, status FROM players WHERE id = ?').get(tid);
    if (!target) {
      return res.status(400).json({ error: `Joueur cible ${tid} introuvable.` });
    }
    if (target.status !== 'alive') {
      return res.status(400).json({ error: `Le joueur cible doit être vivant.` });
    }
  }

  try {
    const identifications = submitGhostIdentifications(
      currentPhase.id,
      player.id,
      numericTargetIds
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
 * POST /api/player/special-respond
 * Player responds to a special role prompt.
 * Body: { type, response } where response varies by type:
 *   protecteur: { targetId }
 *   sorciere: { resurrect: true/false }
 *   voyante: { targetId }
 *   chasseur: { targetId }
 *   mayor_succession: { targetId }
 */
router.post('/special-respond', requirePlayer, (req, res) => {
  const { type, response } = req.body;
  const player = req.player;

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'type est requis.' });
  }
  if (!response || typeof response !== 'object') {
    return res.status(400).json({ error: 'response est requis.' });
  }

  const io = req.app.get('io');
  const db = getDb();
  const currentPhase = getCurrentPhase();
  const phaseId = currentPhase?.id || null;

  try {
    let result;

    switch (type) {
      case 'protecteur': {
        if (!response.targetId) {
          return res.status(400).json({ error: 'targetId requis.' });
        }
        // Verify the responding player is the protector
        if (player.special_role !== 'protecteur') {
          return res.status(403).json({ error: 'Vous n\'êtes pas le protecteur.' });
        }
        // Validate target exists and is alive
        const protTarget = db.prepare('SELECT id, status FROM players WHERE id = ?').get(Number(response.targetId));
        if (!protTarget) {
          return res.status(400).json({ error: 'Joueur cible introuvable.' });
        }
        if (protTarget.status !== 'alive') {
          return res.status(400).json({ error: 'Le joueur cible doit être vivant.' });
        }
        result = processProtecteurResponse(io, Number(response.targetId));
        break;
      }
      case 'sorciere': {
        // Verify the responding player is the witch
        if (player.special_role !== 'sorciere') {
          return res.status(403).json({ error: 'Vous n\'êtes pas la sorcière.' });
        }
        const victimIdStr = getSetting('sorciere_victim_id');
        const victimId = victimIdStr ? Number(victimIdStr) : null;
        result = processSorciereResponse(io, !!response.resurrect, victimId);
        break;
      }
      case 'voyante': {
        if (!response.targetId) {
          return res.status(400).json({ error: 'targetId requis.' });
        }
        // Verify the responding player is the seer
        if (player.special_role !== 'voyante') {
          return res.status(403).json({ error: 'Vous n\'êtes pas la voyante.' });
        }
        // Validate target exists
        const seerTarget = db.prepare('SELECT id FROM players WHERE id = ?').get(Number(response.targetId));
        if (!seerTarget) {
          return res.status(400).json({ error: 'Joueur cible introuvable.' });
        }
        result = processVoyanteResponse(io, Number(response.targetId));
        break;
      }
      case 'chasseur': {
        if (!response.targetId) {
          return res.status(400).json({ error: 'targetId requis.' });
        }
        // Verify the responding player is the hunter
        if (player.special_role !== 'chasseur') {
          return res.status(403).json({ error: 'Vous n\'êtes pas le chasseur.' });
        }
        // Validate target exists and is alive
        const hunterTarget = db.prepare('SELECT id, status FROM players WHERE id = ?').get(Number(response.targetId));
        if (!hunterTarget) {
          return res.status(400).json({ error: 'Joueur cible introuvable.' });
        }
        if (hunterTarget.status !== 'alive') {
          return res.status(400).json({ error: 'Le joueur cible doit être vivant.' });
        }
        result = processChasseurResponse(io, Number(response.targetId), phaseId);
        break;
      }
      case 'mayor_succession': {
        if (!response.targetId) {
          return res.status(400).json({ error: 'targetId requis.' });
        }
        // Verify the responding player is the current mayor
        const mayorIdStr = getSetting('mayor_id');
        if (!mayorIdStr || Number(mayorIdStr) !== player.id) {
          return res.status(403).json({ error: 'Vous n\'êtes pas le maire.' });
        }
        // Validate target exists and is alive
        const successionTarget = db.prepare('SELECT id, status FROM players WHERE id = ?').get(Number(response.targetId));
        if (!successionTarget) {
          return res.status(400).json({ error: 'Joueur cible introuvable.' });
        }
        if (successionTarget.status !== 'alive') {
          return res.status(400).json({ error: 'Le nouveau maire doit être un joueur vivant.' });
        }
        result = processMayorSuccession(io, Number(response.targetId));
        break;
      }
      default:
        return res.status(400).json({ error: `Type de pouvoir inconnu: ${type}` });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Emit a phase:vote_update event with current vote counts.
 * Uses the shared computeVoteCounts helper from socket-rooms.
 * Counts combine wolf + villager_guess for night (shared counter),
 * or village for council.
 */
function emitVoteUpdate(io, currentPhase) {
  if (!io || !currentPhase) return;

  const { voteCount, totalExpected } = computeVoteCounts(currentPhase.id, currentPhase.type);

  const payload = {
    phaseId: currentPhase.id,
    voteCount,
    totalExpected,
  };

  // Broadcast to all clients (players, dashboard, admin)
  emitToAll(io, 'phase:vote_update', payload);
}

export default router;
