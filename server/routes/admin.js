import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { adminAuth } from '../middleware/auth.js';
import { getDb, getAllSettings, getSetting, setSetting, resetGame } from '../db.js';
import logger from '../logger.js';
import {
  assignRoles,
  createPhase,
  startPhase,
  openVoting,
  closeVoting,
  getCurrentPhase,
  getVoteResults,
  getVoteDetails,
  submitVote,
  resolveNight,
  resolveVillageCouncil,
  generateSpeechOrder,
  eliminatePlayer,
  protectPlayer,
  clearProtection,
  resurrectPlayer,
  computePhaseScores,
  computeChallengeScores,
  computeFinalScores,
  getScoreboard,
} from '../game-engine.js';
import {
  emitToPlayer,
  emitToWolves,
  emitToAll,
  emitToAdmin,
  emitToDashboard,
  updatePlayerRooms,
  computeVoteCounts,
} from '../socket-rooms.js';
import { resyncPlayer } from '../socket-handlers.js';
import {
  handleProtecteur,
  processProtecteurResponse,
  handleSorciere,
  processSorciereResponse,
  handleVoyante,
  processVoyanteResponse,
  handleChasseur,
  processChasseurResponse,
  handleMayorSuccession,
  processMayorSuccession,
  forceMayorSuccession,
  handleImmunite,
  getSpecialRolesStatus,
  getMayorInfo,
} from '../special-roles.js';

const router = Router();

// All admin routes require authentication
router.use(adminAuth);

// ─── Setup ──────────────────────────────────────────────────────────────────

router.post('/players/bulk', (req, res) => {
  const { names } = req.body;
  if (!names || !Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Un tableau "names" est requis' });
  }

  const db = getDb();
  const insert = db.prepare('INSERT OR IGNORE INTO players (name, session_token) VALUES (?, ?)');
  const created = [];
  const skipped = [];

  db.transaction(() => {
    for (const rawName of names) {
      const name = String(rawName).trim();
      if (!name) continue;

      const existing = db.prepare('SELECT id FROM players WHERE name = ?').get(name);
      if (existing) {
        skipped.push(name);
        continue;
      }

      const token = uuidv4();
      const result = insert.run(name, token);
      created.push({ id: Number(result.lastInsertRowid), name });
    }
  })();

  const io = req.app.get('io');
  if (io) {
    const players = db.prepare('SELECT id, name FROM players ORDER BY id').all();
    const lobbyData = { playerCount: players.length, players };
    emitToAdmin(io, 'lobby:update', lobbyData);
    emitToDashboard(io, 'lobby:update', lobbyData);
  }

  res.json({ created, skipped });
});

router.delete('/players/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);

  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  // Only allow deletion during setup
  const gameStatus = getSetting('game_status');
  if (gameStatus !== 'setup') {
    return res.status(400).json({ error: 'Impossible de supprimer un joueur pendant la partie' });
  }

  db.prepare('DELETE FROM players WHERE id = ?').run(id);

  const io = req.app.get('io');
  if (io) {
    const players = db.prepare('SELECT id, name FROM players ORDER BY id').all();
    const lobbyData = { playerCount: players.length, players };
    emitToAdmin(io, 'lobby:update', lobbyData);
    emitToDashboard(io, 'lobby:update', lobbyData);
  }

  res.json({ deleted: true, id });
});

router.get('/players', (req, res) => {
  const players = getDb().prepare('SELECT * FROM players ORDER BY id').all();
  res.json(players);
});

router.post('/game/assign-roles', (req, res) => {
  const numWolves = req.body.numWolves ? Number(req.body.numWolves) : Number(getSetting('num_wolves'));

  // Validate numWolves is a positive integer
  if (!Number.isInteger(numWolves) || numWolves < 1) {
    return res.status(400).json({ error: 'Le nombre de loups doit être un entier positif' });
  }

  // Validate numWolves is less than total players
  const db = getDb();
  const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
  if (numWolves >= playerCount) {
    return res.status(400).json({
      error: `Impossible d'assigner ${numWolves} loups parmi ${playerCount} joueurs`,
    });
  }

  try {
    const players = assignRoles(numWolves);
    setSetting('num_wolves', String(numWolves));
    res.json({ players });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/game/start', (req, res) => {
  const db = getDb();
  const gameStatus = getSetting('game_status');

  if (gameStatus !== 'setup') {
    return res.status(400).json({ error: 'La partie a déjà démarré' });
  }

  const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
  if (playerCount === 0) {
    return res.status(400).json({ error: 'Aucun joueur enregistré' });
  }

  // Check roles are assigned
  const unassigned = db.prepare('SELECT COUNT(*) as count FROM players WHERE role IS NULL').get().count;
  if (unassigned > 0) {
    return res.status(400).json({ error: `${unassigned} joueur(s) n'ont pas de rôle assigné` });
  }

  setSetting('game_status', 'in_progress');
  logger.game('Game started', { playerCount });

  const io = req.app.get('io');
  if (io) {
    // Send game:started to each player individually with their role
    const players = db.prepare('SELECT * FROM players').all();
    for (const player of players) {
      emitToPlayer(io, player.id, 'game:started', {
        role: player.role,
      });
    }

    // Reveal wolves to each other
    const wolves = db.prepare("SELECT id, name FROM players WHERE role = 'wolf'").all();
    emitToWolves(io, 'wolves:revealed', { wolves });

    // Notify dashboard
    emitToDashboard(io, 'game:started', {});

    // Notify admin
    emitToAdmin(io, 'game:started', {});
  }

  res.json({ status: 'in_progress', playerCount });
});

// ─── Phases ─────────────────────────────────────────────────────────────────

router.post('/phase/create', (req, res) => {
  const { type } = req.body;
  if (!type || (type !== 'night' && type !== 'village_council')) {
    return res.status(400).json({ error: 'Type de phase invalide. Valeurs acceptées: night, village_council' });
  }

  // Game must be in progress
  const gameStatus = getSetting('game_status');
  if (gameStatus !== 'in_progress') {
    return res.status(400).json({ error: 'La partie doit être en cours pour créer une phase' });
  }

  try {
    const phase = createPhase(type);
    logger.phase('Phase created', { phaseId: phase.id, type });
    res.json(phase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/phase/start', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  // Validate phase exists before attempting to start
  const dbCheck = getDb();
  const phaseCheck = dbCheck.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phaseCheck) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }
  if (phaseCheck.status !== 'pending') {
    return res.status(400).json({ error: `Impossible de démarrer une phase en statut "${phaseCheck.status}"` });
  }

  try {
    const phase = startPhase(Number(phaseId));
    logger.phase('Phase started', { phaseId: phase.id, type: phase.type });
    const db = getDb();

    const io = req.app.get('io');
    if (io) {
      // Build role-specific payloads for phase start
      const alivePlayers = db.prepare("SELECT id, name, status FROM players WHERE status = 'alive'").all();
      const aliveGhosts = db.prepare("SELECT id, name, status FROM players WHERE status = 'ghost'").all();

      if (phase.type === 'night') {
        // Wolves see list of alive non-wolf targets
        const wolfTargets = db
          .prepare("SELECT id, name FROM players WHERE status = 'alive' AND role != 'wolf'")
          .all();
        emitToWolves(io, 'phase:started', {
          phase,
          phaseType: 'night',
          targets: wolfTargets,
        });

        // Alive villagers see villager guess targets (all alive players except themselves — handled client-side)
        const allAlive = db
          .prepare("SELECT id, name FROM players WHERE status = 'alive'")
          .all();

        // Send to each alive villager individually
        const aliveVillagers = db
          .prepare("SELECT id FROM players WHERE status = 'alive' AND role = 'villager'")
          .all();
        for (const v of aliveVillagers) {
          emitToPlayer(io, v.id, 'phase:started', {
            phase,
            phaseType: 'night',
            targets: allAlive.filter(p => p.id !== v.id),
          });
        }

        // Ghosts see their options
        const ghostPlayers = db
          .prepare("SELECT id, role FROM players WHERE status = 'ghost'")
          .all();
        for (const ghost of ghostPlayers) {
          const ghostTargets = db
            .prepare("SELECT id, name FROM players WHERE status = 'alive'")
            .all();
          emitToPlayer(io, ghost.id, 'phase:started', {
            phase,
            phaseType: 'night',
            targets: ghostTargets,
            isGhost: true,
            canIdentify: ghost.role === 'villager',
          });
        }
      } else {
        // Village council — all alive players vote, everyone sees the same
        emitToAll(io, 'phase:started', {
          phase,
          phaseType: 'village_council',
          targets: alivePlayers,
        });
      }

      // Also send to dashboard and admin (non-role-specific)
      emitToDashboard(io, 'phase:started', { phase, phaseType: phase.type });
      emitToAdmin(io, 'phase:started', { phase, phaseType: phase.type });
    }

    // For night phases, automatically open voting (no separate step needed)
    if (phase.type === 'night') {
      const votingPhase = openVoting(phase.id);
      logger.phase('Voting auto-opened for night phase', { phaseId: votingPhase.id });

      if (io) {
        emitToAll(io, 'phase:voting_opened', { phase: votingPhase, phaseId: votingPhase.id });
      }

      return res.json(votingPhase);
    }

    res.json(phase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/phase/open-voting', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  // Validate phase exists and is in correct status
  const dbCheck = getDb();
  const phaseCheck = dbCheck.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phaseCheck) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }
  if (phaseCheck.status !== 'active') {
    return res.status(400).json({ error: `Impossible d'ouvrir le vote pour une phase en statut "${phaseCheck.status}"` });
  }

  try {
    const phase = openVoting(Number(phaseId));
    logger.phase('Voting opened', { phaseId: phase.id });

    const io = req.app.get('io');
    if (io) {
      emitToAll(io, 'phase:voting_opened', { phase, phaseId: phase.id });
    }

    res.json(phase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/phase/close-voting', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  // Validate phase exists and is in voting status
  const dbCheck = getDb();
  const phaseCheck = dbCheck.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phaseCheck) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }
  if (phaseCheck.status !== 'voting') {
    return res.status(400).json({ error: `Impossible de fermer le vote pour une phase en statut "${phaseCheck.status}"` });
  }

  try {
    // Force-close: works even if not everyone has voted.
    // Absent players' votes are simply not counted (abstention).
    const phase = closeVoting(Number(phaseId));
    logger.phase('Voting closed', { phaseId: phase.id });

    const io = req.app.get('io');
    if (io) {
      emitToAll(io, 'phase:voting_closed', { phase, phaseId: phase.id });
    }

    res.json(phase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/phase/results', (req, res) => {
  const phaseId = req.query.phaseId;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis (query param)' });
  }

  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  try {
    let results;
    if (phase.type === 'night') {
      results = resolveNight(Number(phaseId));
    } else {
      results = resolveVillageCouncil(Number(phaseId));
    }
    res.json({ phase, results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/phase/reveal', (req, res) => {
  const { phaseId, victims } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  const io = req.app.get('io');
  const eliminated = [];

  const immuneApplied = [];

  // Apply eliminations if provided
  if (victims && Array.isArray(victims)) {
    for (const victim of victims) {
      try {
        // Check immunity before eliminating
        const immuneResult = handleImmunite(Number(phaseId), victim.playerId);
        if (immuneResult.applied) {
          immuneApplied.push({ playerId: victim.playerId, playerName: immuneResult.playerName });
          logger.special('Immunity applied', { playerId: victim.playerId, playerName: immuneResult.playerName });
          continue; // Skip elimination — player is immune
        }

        const player = eliminatePlayer(victim.playerId, Number(phaseId), victim.eliminatedBy);
        eliminated.push(player);
        logger.phase('Player eliminated via reveal', { playerId: player.id, playerName: player.name, eliminatedBy: victim.eliminatedBy });

        // Update room membership: player becomes ghost
        if (io) {
          updatePlayerRooms(io, victim.playerId, 'ghost');
        }
      } catch (err) {
        // Skip errors (e.g., already eliminated)
        logger.error('Could not eliminate player', { playerId: victim.playerId, error: err.message });
      }
    }
  }

  // Clear protection after night
  if (phase.type === 'night') {
    clearProtection();
  }

  // Compute phase scores
  let scoreChanges = [];
  try {
    scoreChanges = computePhaseScores(Number(phaseId));
    if (scoreChanges.length > 0) {
      logger.score('Phase scores computed', { phaseId: Number(phaseId), changes: scoreChanges.length });
    }
  } catch (err) {
    logger.error('Could not compute phase scores', { phaseId: Number(phaseId), error: err.message });
  }

  if (io) {
    const eliminatedData = eliminated.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      eliminatedBy: p.eliminated_by,
    }));

    // Broadcast phase result to all
    emitToAll(io, 'phase:result', {
      phase,
      eliminated: eliminatedData,
      noVictim: eliminatedData.length === 0,
    });

    // Send player:eliminated to each eliminated player specifically
    for (const p of eliminated) {
      emitToPlayer(io, p.id, 'player:eliminated', {
        playerId: p.id,
      });
    }

    // Check if hunter was eliminated — trigger hunter power
    for (const p of eliminated) {
      if (p.special_role === 'chasseur') {
        handleChasseur(io, p.id);
      }
    }

    // Check if mayor was eliminated — trigger succession
    const mayorIdStr = getSetting('mayor_id');
    if (mayorIdStr) {
      const mayorId = Number(mayorIdStr);
      const eliminatedMayor = eliminated.find(p => p.id === mayorId);
      if (eliminatedMayor) {
        handleMayorSuccession(io, mayorId);
      }
    }
  }

  // Clear current phase
  setSetting('current_phase_id', null);

  res.json({ phase, eliminated, scoreChanges, immuneApplied });
});

router.post('/phase/skip', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  db.prepare(
    "UPDATE phases SET status = 'completed', timestamp_end = datetime('now') WHERE id = ?"
  ).run(Number(phaseId));

  const currentPhaseId = getSetting('current_phase_id');
  if (currentPhaseId && Number(currentPhaseId) === Number(phaseId)) {
    setSetting('current_phase_id', null);
  }

  logger.phase('Phase skipped', { phaseId: Number(phaseId) });
  res.json({ skipped: true, phaseId: Number(phaseId) });
});

router.get('/phase/votes', (req, res) => {
  const phaseId = req.query.phaseId;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis (query param)' });
  }

  const details = getVoteDetails(Number(phaseId));
  const wolfResults = getVoteResults(Number(phaseId), 'wolf');
  const villagerGuessResults = getVoteResults(Number(phaseId), 'villager_guess');
  const ghostResults = getVoteResults(Number(phaseId), 'ghost_eliminate');
  const villageResults = getVoteResults(Number(phaseId), 'village');

  res.json({
    details,
    wolfResults,
    villagerGuessResults,
    ghostResults,
    villageResults,
  });
});

router.post('/phase/speech-order', (req, res) => {
  const order = generateSpeechOrder();

  const io = req.app.get('io');
  if (io) {
    emitToAll(io, 'speech:order', { order });
  }

  res.json({ order });
});

router.post('/phase/broadcast-speech-order', (req, res) => {
  const { order } = req.body;
  if (!order || !Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: 'order (tableau) requis' });
  }

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:speech_order', { order });
  }

  res.json({ broadcast: true });
});

router.post('/timer/start', (req, res) => {
  const { duration } = req.body;
  if (!duration || typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: 'duration (secondes) requis' });
  }

  // Persist timer state to DB so reconnecting clients can recover it
  setSetting('timer_duration', String(duration));
  setSetting('timer_started_at', String(Date.now()));

  const io = req.app.get('io');
  if (io) {
    // Send to dashboard and all players (not just admin)
    emitToDashboard(io, 'timer:start', { duration });
    // Also broadcast to all players
    const db = getDb();
    const players = db.prepare('SELECT id FROM players').all();
    for (const p of players) {
      emitToPlayer(io, p.id, 'timer:start', { duration });
    }
    // Also notify admin
    emitToAdmin(io, 'timer:start', { duration });
  }

  res.json({ started: true, duration });
});

// ─── Special powers ─────────────────────────────────────────────────────────

router.post('/special/trigger', (req, res) => {
  const { playerId, power, phaseId, victimId } = req.body;
  if (!power) {
    return res.status(400).json({ error: 'power requis' });
  }

  const io = req.app.get('io');
  const currentPhase = getCurrentPhase();
  const effectivePhaseId = phaseId ? Number(phaseId) : (currentPhase?.id || null);

  try {
    let result;

    switch (power) {
      case 'protecteur':
        logger.special('Protecteur triggered', { phaseId: effectivePhaseId });
        result = handleProtecteur(io, effectivePhaseId);
        break;

      case 'sorciere':
        if (!victimId) {
          return res.status(400).json({ error: 'victimId requis pour la sorcière' });
        }
        logger.special('Sorciere triggered', { phaseId: effectivePhaseId, victimId: Number(victimId) });
        result = handleSorciere(io, effectivePhaseId, Number(victimId));
        break;

      case 'voyante':
        logger.special('Voyante triggered', { phaseId: effectivePhaseId });
        result = handleVoyante(io, effectivePhaseId);
        break;

      case 'chasseur':
        if (!playerId) {
          return res.status(400).json({ error: 'playerId requis pour le chasseur' });
        }
        result = handleChasseur(io, Number(playerId));
        break;

      case 'mayor_succession':
        if (!playerId) {
          return res.status(400).json({ error: 'playerId requis pour la succession du maire' });
        }
        result = handleMayorSuccession(io, Number(playerId));
        break;

      default: {
        // Fallback: generic trigger (send prompt directly to player)
        if (!playerId) {
          return res.status(400).json({ error: 'playerId requis' });
        }
        const db = getDb();
        const player = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
        if (!player) {
          return res.status(404).json({ error: 'Joueur introuvable' });
        }

        if (io) {
          emitToPlayer(io, player.id, 'special:prompt', {
            power,
            playerId: player.id,
            playerName: player.name,
          });
        }

        result = { triggered: true, power, playerId: player.id };
      }
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/special/force', (req, res) => {
  const { power, playerId, targetId, decision, phaseId } = req.body;
  if (!power) {
    return res.status(400).json({ error: 'power requis' });
  }

  const io = req.app.get('io');
  const db = getDb();

  // Helper: validate a target ID exists in the database
  function validateTarget(tid) {
    if (!tid) return null;
    return db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(Number(tid));
  }

  try {
    switch (power) {
      case 'protecteur': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const target = validateTarget(targetId);
        if (!target) return res.status(404).json({ error: 'Joueur cible introuvable' });
        const result = processProtecteurResponse(io, Number(targetId));
        res.json({ applied: true, power, ...result });
        break;
      }
      case 'sorciere': {
        const victimIdStr = getSetting('sorciere_victim_id');
        const effectiveVictimId = targetId || (victimIdStr ? Number(victimIdStr) : null);

        if (decision === 'resurrect' && effectiveVictimId) {
          const result = processSorciereResponse(io, true, effectiveVictimId);
          res.json({ applied: true, power, ...result });
        } else {
          const result = processSorciereResponse(io, false, effectiveVictimId);
          res.json({ applied: true, power, ...result });
        }
        break;
      }
      case 'voyante': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const target = validateTarget(targetId);
        if (!target) return res.status(404).json({ error: 'Joueur cible introuvable' });
        const result = processVoyanteResponse(io, Number(targetId));
        res.json({ applied: true, power, ...result });
        break;
      }
      case 'chasseur': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const target = validateTarget(targetId);
        if (!target) return res.status(404).json({ error: 'Joueur cible introuvable' });
        if (target.status !== 'alive') {
          return res.status(400).json({ error: 'Le joueur cible doit être vivant' });
        }
        const currentPhase = getCurrentPhase();
        const effectivePhaseId = phaseId ? Number(phaseId) : (currentPhase?.id || null);
        const result = processChasseurResponse(io, Number(targetId), effectivePhaseId);
        res.json({ applied: true, power, ...result });
        break;
      }
      case 'mayor_succession': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const target = validateTarget(targetId);
        if (!target) return res.status(404).json({ error: 'Joueur cible introuvable' });
        if (target.status !== 'alive') {
          return res.status(400).json({ error: 'Le nouveau maire doit être un joueur vivant' });
        }
        const result = forceMayorSuccession(io, Number(targetId));
        res.json({ applied: true, power, ...result });
        break;
      }
      default:
        res.status(400).json({ error: `Pouvoir inconnu: ${power}` });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/special/status', (req, res) => {
  try {
    const status = getSpecialRolesStatus();
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/special/skip', (req, res) => {
  const { power } = req.body;
  if (!power) {
    return res.status(400).json({ error: 'power requis' });
  }

  const io = req.app.get('io');

  switch (power) {
    case 'protecteur':
      setSetting('protecteur_pending', '0');
      clearProtection();
      break;
    case 'sorciere':
      setSetting('sorciere_pending', '0');
      setSetting('sorciere_victim_id', null);
      break;
    case 'voyante':
      setSetting('voyante_pending', '0');
      break;
    case 'chasseur':
      setSetting('hunter_pending', '0');
      setSetting('hunter_player_id', null);
      break;
    case 'mayor_succession':
      setSetting('mayor_succession_pending', '0');
      // Mayor position stays vacant
      setSetting('mayor_id', null);
      break;
    default:
      return res.status(400).json({ error: `Pouvoir inconnu: ${power}` });
  }

  if (io) {
    emitToAdmin(io, 'special:result', {
      power,
      action: 'skipped',
    });
  }

  res.json({ skipped: true, power });
});

// ─── Challenges ─────────────────────────────────────────────────────────────

router.post('/challenge', (req, res) => {
  const { name, specialRole, winningPlayerIds, afterPhaseId } = req.body;

  if (!name || !specialRole) {
    return res.status(400).json({ error: 'name et specialRole requis' });
  }

  const validSpecialRoles = ['maire', 'sorciere', 'protecteur', 'voyante', 'chasseur', 'immunite'];
  if (!validSpecialRoles.includes(specialRole)) {
    return res.status(400).json({ error: `Rôle spécial invalide: ${specialRole}. Valeurs acceptées: ${validSpecialRoles.join(', ')}` });
  }

  const db = getDb();
  const playerIdsJson = JSON.stringify(winningPlayerIds || []);

  const result = db.prepare(
    'INSERT INTO challenges (name, special_role_awarded, winning_team_player_ids, after_phase_id) VALUES (?, ?, ?, ?)'
  ).run(name, specialRole, playerIdsJson, afterPhaseId || null);

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(result.lastInsertRowid);

  // Compute challenge scores
  let scoreChanges = [];
  try {
    scoreChanges = computeChallengeScores(challenge.id);
  } catch (err) {
    console.warn(`[ADMIN] Could not compute challenge scores: ${err.message}`);
  }

  res.json({ challenge, scoreChanges });
});

router.post('/challenge/assign', (req, res) => {
  const { challengeId, playerId } = req.body;

  if (!challengeId || !playerId) {
    return res.status(400).json({ error: 'challengeId et playerId requis' });
  }

  const db = getDb();
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(Number(challengeId));
  if (!challenge) {
    return res.status(404).json({ error: 'Épreuve introuvable' });
  }

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  // Check player doesn't already have a special role
  if (player.special_role) {
    return res.status(400).json({ error: `${player.name} a déjà le rôle spécial "${player.special_role}"` });
  }

  db.transaction(() => {
    db.prepare('UPDATE players SET special_role = ? WHERE id = ?').run(challenge.special_role_awarded, Number(playerId));
    db.prepare('UPDATE challenges SET awarded_to_player_id = ? WHERE id = ?').run(Number(playerId), Number(challengeId));
  })();

  const io = req.app.get('io');
  if (io) {
    emitToPlayer(io, playerId, 'player:role_assigned', {
      specialRole: challenge.special_role_awarded,
    });
  }

  res.json({
    assigned: true,
    playerId: Number(playerId),
    specialRole: challenge.special_role_awarded,
  });
});

// ─── Overrides ──────────────────────────────────────────────────────────────

router.put('/player/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  const allowedFields = ['name', 'role', 'special_role', 'status', 'score'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  // Validate field values
  if (updates.role !== undefined && updates.role !== null && !['wolf', 'villager'].includes(updates.role)) {
    return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées: wolf, villager' });
  }
  if (updates.status !== undefined && !['alive', 'ghost'].includes(updates.status)) {
    return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées: alive, ghost' });
  }
  if (updates.special_role !== undefined && updates.special_role !== null) {
    const validSpecialRoles = ['maire', 'sorciere', 'protecteur', 'voyante', 'chasseur', 'immunite'];
    if (!validSpecialRoles.includes(updates.special_role)) {
      return res.status(400).json({ error: `Rôle spécial invalide. Valeurs acceptées: ${validSpecialRoles.join(', ')}, ou null` });
    }
  }
  if (updates.score !== undefined && typeof updates.score !== 'number') {
    return res.status(400).json({ error: 'Le score doit être un nombre' });
  }
  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      return res.status(400).json({ error: 'Le nom ne peut pas être vide' });
    }
    if (updates.name.trim().length > 50) {
      return res.status(400).json({ error: 'Le nom ne peut pas dépasser 50 caractères' });
    }
    updates.name = updates.name.trim();
  }

  const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
  const values = Object.values(updates);

  db.prepare(`UPDATE players SET ${setClauses} WHERE id = ?`).run(...values, id);

  const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);

  // If status changed, update room memberships
  const io = req.app.get('io');
  if (io && updates.status && updates.status !== player.status) {
    updatePlayerRooms(io, id, updates.status);
  }

  // Re-sync the affected player
  if (io) {
    resyncPlayer(io, id);
  }

  res.json(updated);
});

router.post('/phase/undo', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  // Revert phase to active state
  db.prepare("UPDATE phases SET status = 'active', timestamp_end = NULL WHERE id = ?").run(Number(phaseId));

  // Restore victims from this phase
  const victims = db.prepare('SELECT * FROM phase_victims WHERE phase_id = ?').all(Number(phaseId));
  const io = req.app.get('io');

  for (const victim of victims) {
    db.prepare(
      "UPDATE players SET status = 'alive', eliminated_at_phase = NULL, eliminated_by = NULL WHERE id = ?"
    ).run(victim.player_id);

    // Update room memberships: player is alive again
    if (io) {
      updatePlayerRooms(io, victim.player_id, 'alive');
    }
  }
  db.prepare('DELETE FROM phase_victims WHERE phase_id = ?').run(Number(phaseId));

  setSetting('current_phase_id', String(phaseId));

  res.json({ undone: true, phaseId: Number(phaseId), restoredPlayers: victims.length });
});

router.put('/settings', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object of key/value pairs' });
  }
  for (const [key, value] of Object.entries(updates)) {
    setSetting(key, value);
  }
  res.json(getAllSettings());
});

router.post('/game/reset', (req, res) => {
  resetGame();

  // Clear timer settings
  setSetting('timer_duration', null);
  setSetting('timer_started_at', null);

  logger.game('Game reset');

  const io = req.app.get('io');
  if (io) {
    emitToAll(io, 'game:reset', {});
  }

  res.json({ reset: true });
});

// ─── Force Vote ─────────────────────────────────────────────────────────────

router.post('/force-vote', (req, res) => {
  const { phaseId, voterId, targetId, voteType } = req.body;

  if (!phaseId || !voterId || !targetId || !voteType) {
    return res.status(400).json({ error: 'phaseId, voterId, targetId et voteType requis' });
  }

  const validVoteTypes = ['wolf', 'villager_guess', 'ghost_eliminate', 'village'];
  if (!validVoteTypes.includes(voteType)) {
    return res.status(400).json({
      error: `Type de vote invalide: ${voteType}. Valeurs acceptées: ${validVoteTypes.join(', ')}`,
    });
  }

  const db = getDb();

  // Validate phase exists and is in voting status
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(phaseId));
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }
  if (phase.status !== 'voting') {
    return res.status(400).json({ error: `Impossible de forcer un vote pour une phase en statut "${phase.status}"` });
  }

  // Validate voter exists
  const voter = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(voterId));
  if (!voter) {
    return res.status(404).json({ error: 'Joueur votant introuvable' });
  }

  // Validate target exists
  const target = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(targetId));
  if (!target) {
    return res.status(404).json({ error: 'Joueur cible introuvable' });
  }

  try {
    const vote = submitVote(Number(phaseId), Number(voterId), Number(targetId), voteType);
    logger.vote('Vote forced by admin', {
      phaseId: Number(phaseId),
      voterId: Number(voterId),
      voterName: voter.name,
      targetId: Number(targetId),
      targetName: target.name,
      voteType,
      updated: !!vote.updated,
    });

    // Emit vote update with counts (same as normal vote flow)
    const io = req.app.get('io');
    if (io) {
      const { voteCount, totalExpected } = computeVoteCounts(phase.id, phase.type);
      emitToAll(io, 'phase:vote_update', {
        phaseId: phase.id,
        voteCount,
        totalExpected,
      });

      // Re-sync the affected player so their UI shows the vote was submitted
      resyncPlayer(io, Number(voterId));
    }

    res.json({
      success: true,
      voteType,
      voterName: voter.name,
      targetName: target.name,
      updated: !!vote.updated,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/wolf-tie-break', (req, res) => {
  const { phaseId, targetId } = req.body;
  if (!phaseId || !targetId) {
    return res.status(400).json({ error: 'phaseId et targetId requis' });
  }

  // Admin picks the wolf victim in case of tie
  res.json({
    resolved: true,
    phaseId: Number(phaseId),
    victim: { id: Number(targetId) },
  });
});

// ─── Extra endpoints ────────────────────────────────────────────────────────

router.get('/phases', (req, res) => {
  const phases = getDb().prepare('SELECT * FROM phases ORDER BY id DESC').all();
  res.json(phases);
});

router.get('/challenges', (req, res) => {
  const challenges = getDb().prepare('SELECT * FROM challenges ORDER BY id DESC').all();
  res.json(challenges);
});

router.get('/scoreboard', (req, res) => {
  res.json(getScoreboard());
});

router.post('/game/end', (req, res) => {
  setSetting('game_status', 'finished');
  logger.game('Game ended');

  let scoreChanges = [];
  try {
    scoreChanges = computeFinalScores();
    logger.score('Final scores computed', { changes: scoreChanges.length });
  } catch (err) {
    logger.error('Could not compute final scores', { error: err.message });
  }

  const scoreboard = getScoreboard();

  const io = req.app.get('io');
  if (io) {
    // Determine winner
    const db = getDb();
    const aliveWolves = db.prepare("SELECT COUNT(*) as count FROM players WHERE role = 'wolf' AND status = 'alive'").get().count;
    const winner = aliveWolves > 0 ? 'wolves' : 'villagers';

    emitToAll(io, 'game:end', { scoreboard, winner });
  }

  res.json({ status: 'finished', scoreChanges, scoreboard });
});

export default router;
