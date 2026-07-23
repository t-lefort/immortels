import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { adminAuth } from '../middleware/auth.js';
import { getDb, getAllSettings, getSetting, setSetting, resetGame } from '../db.js';
import logger from '../logger.js';
import { hasSpecialRole, addSpecialRole, parseSpecialRoles } from '../role-helpers.js';
import { recordScoreSnapshot, listScoreSnapshots } from '../score-snapshots.js';
import { recordScoreEvent, listScoreEvents } from '../score-events.js';
import { removeSpecialRole } from '../role-helpers.js';
import {
  exportGame,
  importGame,
  validateSnapshot,
  archiveGame,
  listArchives,
  getArchive,
  deleteArchive,
} from '../game-archive.js';
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
  isVoteValid,
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
    // and ensure wolf sockets join the 'wolves' room (they may have
    // connected before roles were assigned, so joinPlayerRooms didn't
    // add them to the wolves room at connection time).
    const players = db.prepare('SELECT * FROM players').all();
    for (const player of players) {
      if (player.role === 'wolf') {
        updatePlayerRooms(io, player.id, undefined, 'wolf');
      }
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
        // Every alive player — wolf or villager — receives the exact same
        // target list (all other alive players). Handing wolves a shorter
        // list would let anyone deduce a role just by counting the names on
        // a screenshot. A wolf voting for a wolf is stored but not counted.
        const allAlive = db
          .prepare("SELECT id, name FROM players WHERE status = 'alive'")
          .all();

        for (const p of allAlive) {
          emitToPlayer(io, p.id, 'phase:started', {
            phase,
            phaseType: 'night',
            targets: allAlive.filter(t => t.id !== p.id),
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

      // Send initial vote progress so dashboard shows "0/N" instead of "0/0"
      const { voteCount, totalExpected } = computeVoteCounts(phase.id, phase.type);
      emitToAll(io, 'phase:vote_update', { phaseId: phase.id, voteCount, totalExpected });
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
  const phaseIdNum = Number(phaseId);
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseIdNum);
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  // Idempotency guard: a phase can only be revealed once.
  // Using an UPSERT allows undo to reset the key to NULL and enable reveal again.
  const revealKey = `phase_revealed_${phaseIdNum}`;
  const revealLock = db.prepare(`
    INSERT INTO game_settings (key, value) VALUES (?, '1')
    ON CONFLICT(key) DO UPDATE SET value = '1'
    WHERE game_settings.value IS NULL
  `).run(revealKey);
  if (revealLock.changes === 0) {
    return res.status(409).json({ error: 'Cette phase a déjà été révélée' });
  }

  const io = req.app.get('io');
  const eliminated = [];

  const immuneApplied = [];
  const immunityConsumedPlayerIds = [];

  // Apply eliminations if provided
  if (victims && Array.isArray(victims)) {
    for (const victim of victims) {
      try {
        // Check immunity before eliminating (only applies to village council)
        if (phase.type === 'village_council') {
          const immuneResult = handleImmunite(phaseIdNum, victim.playerId);
          if (immuneResult.applied) {
            immuneApplied.push({ playerId: victim.playerId, playerName: immuneResult.playerName });
            immunityConsumedPlayerIds.push(Number(victim.playerId));
            logger.special('Immunity applied', { playerId: victim.playerId, playerName: immuneResult.playerName });
            continue; // Skip elimination — player is immune
          }
        }

        const player = eliminatePlayer(victim.playerId, phaseIdNum, victim.eliminatedBy);
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
    scoreChanges = computePhaseScores(phaseIdNum);
    if (scoreChanges.length > 0) {
      logger.score('Phase scores computed', { phaseId: phaseIdNum, changes: scoreChanges.length });
      // Store score changes so phase/undo can revert them
      setSetting(`score_changes_phase_${phaseIdNum}`, JSON.stringify(scoreChanges));
    }
  } catch (err) {
    logger.error('Could not compute phase scores', { phaseId: phaseIdNum, error: err.message });
  }

  if (io) {
    const eliminatedData = eliminated.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      special_role: p.special_role,
      eliminatedBy: p.eliminated_by,
    }));

    // For village council phases, include individual vote details for the dashboard vote reveal
    let councilVotes = null;
    if (phase.type === 'village_council') {
      councilVotes = getVoteDetails(phaseIdNum)
        .filter(v => v.vote_type === 'village')
        .map(v => ({
          voterName: v.voter_name,
          targetName: v.target_name,
          voterId: v.voter_id,
          targetId: v.target_id,
        }));
    }

    // Broadcast phase result to all
    emitToAll(io, 'phase:result', {
      phase,
      eliminated: eliminatedData,
      noVictim: eliminatedData.length === 0,
      councilVotes,
    });

    // Send player:eliminated to each eliminated player specifically
    for (const p of eliminated) {
      emitToPlayer(io, p.id, 'player:eliminated', {
        playerId: p.id,
      });
    }

    // Check if hunter was eliminated — trigger hunter power
    for (const p of eliminated) {
      if (hasSpecialRole(p.special_role, 'chasseur')) {
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
  if (immunityConsumedPlayerIds.length > 0) {
    setSetting(`immunity_used_phase_${phaseIdNum}`, JSON.stringify(immunityConsumedPlayerIds));
  } else {
    setSetting(`immunity_used_phase_${phaseIdNum}`, null);
  }

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

  // Ghost villager identifications
  const db = getDb();
  const ghostIdentifications = db.prepare(`
    SELECT
      gi.ghost_id,
      g.name AS ghost_name,
      gi.target_id,
      t.name AS target_name,
      t.role AS target_role,
      gi.target_is_wolf
    FROM ghost_identifications gi
    JOIN players g ON gi.ghost_id = g.id
    JOIN players t ON gi.target_id = t.id
    WHERE gi.phase_id = ?
  `).all(Number(phaseId));

  res.json({
    details,
    wolfResults,
    villagerGuessResults,
    ghostResults,
    villageResults,
    ghostIdentifications,
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

// Manually move the highlighted speaker on the dashboard's speech order
// (admin watches the projected screen and advances at their own pace).
router.post('/phase/speech-advance', (req, res) => {
  const dir = req.body?.direction === 'prev' ? 'prev' : 'next';

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:speech_advance', { direction: dir });
  }

  res.json({ ok: true, direction: dir });
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
    case 'mayor_succession': {
      setSetting('mayor_succession_pending', '0');
      // Clear maire special_role from old mayor in players table
      const oldMayorIdStr = getSetting('mayor_id');
      if (oldMayorIdStr) {
        const skipDb = getDb();
        const oldMayor = skipDb.prepare('SELECT special_role FROM players WHERE id = ?').get(Number(oldMayorIdStr));
        if (oldMayor) {
          const updatedRole = removeSpecialRole(oldMayor.special_role, 'maire');
          skipDb.prepare('UPDATE players SET special_role = ? WHERE id = ?').run(updatedRole, Number(oldMayorIdStr));
        }
      }
      // Mayor position stays vacant
      setSetting('mayor_id', null);
      // Trigger admin player list refresh
      if (io) {
        emitToAdmin(io, 'lobby:update', {});
      }
      break;
    }
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

  if (!name) {
    return res.status(400).json({ error: 'name requis' });
  }

  const validSpecialRoles = ['maire', 'sorciere', 'protecteur', 'voyante', 'chasseur', 'immunite'];
  if (specialRole && !validSpecialRoles.includes(specialRole)) {
    return res.status(400).json({ error: `Rôle spécial invalide: ${specialRole}. Valeurs acceptées: ${validSpecialRoles.join(', ')}` });
  }

  const db = getDb();
  if (winningPlayerIds !== undefined && !Array.isArray(winningPlayerIds)) {
    return res.status(400).json({ error: 'winningPlayerIds doit être un tableau' });
  }

  const normalizedWinningPlayerIds = [...new Set((winningPlayerIds || []).map(Number))];
  if (normalizedWinningPlayerIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ error: 'Un ou plusieurs gagnants sont invalides' });
  }

  const getPlayer = db.prepare('SELECT id FROM players WHERE id = ?');
  if (normalizedWinningPlayerIds.some(id => !getPlayer.get(id))) {
    return res.status(400).json({ error: 'Un ou plusieurs gagnants sont introuvables' });
  }

  const playerIdsJson = JSON.stringify(normalizedWinningPlayerIds);

  const result = db.prepare(
    'INSERT INTO challenges (name, special_role_awarded, winning_team_player_ids, after_phase_id) VALUES (?, ?, ?, ?)'
  ).run(name, specialRole || '', playerIdsJson, afterPhaseId || null);

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

/**
 * PUT /challenge/:id/winners { winningPlayerIds }
 *
 * Records (or corrects) the winning team of an épreuve. Only the difference
 * with the previously stored team is scored, so fixing a mistake doesn't
 * double-award anyone or leave a stale point behind.
 */
router.put('/challenge/:id/winners', (req, res) => {
  const { winningPlayerIds } = req.body;
  const challengeId = Number(req.params.id);

  if (!Array.isArray(winningPlayerIds)) {
    return res.status(400).json({ error: 'winningPlayerIds doit être un tableau' });
  }

  const db = getDb();
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!challenge) {
    return res.status(404).json({ error: 'Épreuve introuvable' });
  }

  const nextIds = [...new Set(winningPlayerIds.map(Number))];
  if (nextIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ error: 'Un ou plusieurs gagnants sont invalides' });
  }

  const getPlayer = db.prepare('SELECT id, name FROM players WHERE id = ?');
  const missing = nextIds.filter(id => !getPlayer.get(id));
  if (missing.length > 0) {
    return res.status(400).json({ error: 'Un ou plusieurs gagnants sont introuvables' });
  }

  let previousIds = [];
  try {
    const parsed = JSON.parse(challenge.winning_team_player_ids || '[]');
    previousIds = Array.isArray(parsed) ? [...new Set(parsed.map(Number))] : [];
  } catch {
    previousIds = [];
  }

  const added = nextIds.filter(id => !previousIds.includes(id));
  const removed = previousIds.filter(id => !nextIds.includes(id));

  const scoreChanges = [];

  if (added.length > 0 || removed.length > 0) {
    recordScoreSnapshot('challenge_winners_updated', {
      challengeId,
      added,
      removed,
    });
  }

  const updateScore = db.prepare('UPDATE players SET score = score + ? WHERE id = ?');

  db.transaction(() => {
    db.prepare('UPDATE challenges SET winning_team_player_ids = ? WHERE id = ?')
      .run(JSON.stringify(nextIds), challengeId);

    for (const [ids, delta, reason] of [
      [added, 1, 'challenge_winner'],
      [removed, -1, 'challenge_winner_removed'],
    ]) {
      for (const playerId of ids) {
        const player = getPlayer.get(playerId);
        if (!player) continue;
        updateScore.run(delta, playerId);
        recordScoreEvent({
          playerId,
          sourceType: 'challenge',
          sourceId: challengeId,
          reason,
          delta,
          metadata: { challengeName: challenge.name },
        }, db);
        scoreChanges.push({ playerId, playerName: player.name, delta, reason });
      }
    }
  })();

  logger.score('Challenge winners updated', { challengeId, added: added.length, removed: removed.length });

  const updated = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  res.json({ challenge: updated, scoreChanges });
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

  if (!challenge.special_role_awarded) {
    return res.status(400).json({ error: 'Cette épreuve n\'attribue pas de rôle spécial' });
  }

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  // Check player doesn't already have THIS specific role
  if (hasSpecialRole(player.special_role, challenge.special_role_awarded)) {
    return res.status(400).json({ error: `${player.name} a déjà le rôle spécial "${challenge.special_role_awarded}"` });
  }

  const newSpecialRole = addSpecialRole(player.special_role, challenge.special_role_awarded);

  db.transaction(() => {
    db.prepare('UPDATE players SET special_role = ? WHERE id = ?').run(newSpecialRole, Number(playerId));
    db.prepare('UPDATE challenges SET awarded_to_player_id = ? WHERE id = ?').run(Number(playerId), Number(challengeId));

    // When assigning maire role, also set the mayor_id game setting
    if (challenge.special_role_awarded === 'maire') {
      setSetting('mayor_id', String(playerId));
    }
  })();

  // Re-read the player to get the full composite special_role
  const updatedPlayer = db.prepare('SELECT special_role FROM players WHERE id = ?').get(Number(playerId));

  const io = req.app.get('io');
  if (io) {
    emitToPlayer(io, playerId, 'player:role_assigned', {
      specialRole: updatedPlayer.special_role,
    });
  }

  res.json({
    assigned: true,
    playerId: Number(playerId),
    specialRole: challenge.special_role_awarded,
  });
});

// ─── Challenge Display (Dashboard) ──────────────────────────────────────────

router.post('/challenge/display', (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name requis' });
  }

  const challengeName = String(name).trim();
  setSetting('challenge_display_name', challengeName);

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:challenge', { name: challengeName });
  }

  res.json({ displayed: true, name: challengeName });
});

router.post('/vote-reveal/dismiss', (req, res) => {
  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:vote_reveal_dismiss', {});
  }

  res.json({ dismissed: true });
});

/**
 * Build the council vote breakdown of a past phase: who voted for whom, plus
 * the player eliminated that phase (highlighted in the reveal).
 */
function buildCouncilVoteReveal(phaseId) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseId);
  if (!phase) return { error: 'Phase introuvable' };
  if (phase.type !== 'village_council') {
    return { error: 'Cette phase n\'est pas un conseil du village' };
  }

  const councilVotes = getVoteDetails(phaseId)
    .filter(v => v.vote_type === 'village' && v.target_id != null)
    .map(v => ({
      voterName: v.voter_name,
      targetName: v.target_name,
      voterId: v.voter_id,
      targetId: v.target_id,
    }));

  if (councilVotes.length === 0) {
    return { error: 'Aucun vote enregistré pour cette phase' };
  }

  const victim = db.prepare(`
    SELECT p.id, p.name, p.role, p.special_role
    FROM phase_victims pv
    JOIN players p ON pv.player_id = p.id
    WHERE pv.phase_id = ? AND pv.eliminated_by = 'village' AND pv.was_resurrected = 0
    LIMIT 1
  `).get(phaseId);

  return { phase, councilVotes, eliminatedPlayer: victim || null };
}

/**
 * Re-display the votes of any past council on the dashboard.
 * Lets the admin bring a previous vote back up for discussion.
 */
router.post('/vote-reveal/show', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  const data = buildCouncilVoteReveal(Number(phaseId));
  if (data.error) {
    return res.status(400).json({ error: data.error });
  }

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:vote_reveal', {
      phaseId: Number(phaseId),
      councilVotes: data.councilVotes,
      eliminatedPlayer: data.eliminatedPlayer,
    });
  }

  logger.phase('Council votes re-displayed on dashboard', { phaseId: Number(phaseId) });
  res.json({ shown: true, phaseId: Number(phaseId), voteCount: data.councilVotes.length });
});

/**
 * Council vote breakdown of a past phase, for the admin's shareable image.
 */
router.get('/vote-reveal/:phaseId', (req, res) => {
  const data = buildCouncilVoteReveal(Number(req.params.phaseId));
  if (data.error) {
    return res.status(400).json({ error: data.error });
  }
  res.json({
    phase: data.phase,
    councilVotes: data.councilVotes,
    eliminatedPlayer: data.eliminatedPlayer,
  });
});

router.post('/dashboard/force-home', (req, res) => {
  setSetting('challenge_display_name', null);

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:force_home', {});
  }

  res.json({ ok: true });
});

router.post('/challenge/display-clear', (req, res) => {
  setSetting('challenge_display_name', null);

  const io = req.app.get('io');
  if (io) {
    emitToDashboard(io, 'dashboard:challenge_clear', {});
  }

  res.json({ cleared: true });
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
    // Support comma-separated multiple roles
    const rolesArray = parseSpecialRoles(updates.special_role);
    for (const r of rolesArray) {
      if (!validSpecialRoles.includes(r)) {
        return res.status(400).json({ error: `Rôle spécial invalide: "${r}". Valeurs acceptées: ${validSpecialRoles.join(', ')}, ou null` });
      }
    }
    // Normalize: deduplicate and rejoin
    const uniqueRoles = [...new Set(rolesArray)];
    updates.special_role = uniqueRoles.length > 0 ? uniqueRoles.join(',') : null;
  }
  if (updates.score !== undefined && !Number.isInteger(updates.score)) {
    return res.status(400).json({ error: 'Le score doit être un nombre entier' });
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

  if (updates.score !== undefined && updates.score !== player.score) {
    recordScoreSnapshot('admin_score_override', {
      playerId: id,
      previousScore: player.score,
      newScore: updates.score,
    });
  }

  const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
  const values = Object.values(updates);

  db.transaction(() => {
    db.prepare(`UPDATE players SET ${setClauses} WHERE id = ?`).run(...values, id);
    if (updates.score !== undefined && updates.score !== player.score) {
      recordScoreEvent({
        playerId: id,
        sourceType: 'admin',
        reason: 'admin_score_override',
        delta: updates.score - player.score,
        metadata: { previousScore: player.score, newScore: updates.score },
      }, db);
    }
  })();

  // Sync mayor_id game setting when special_role changes involving 'maire'
  if (updates.special_role !== undefined) {
    const hadMaire = hasSpecialRole(player.special_role, 'maire');
    const hasMaire = hasSpecialRole(updates.special_role, 'maire');
    if (!hadMaire && hasMaire) {
      // Maire added to this player
      setSetting('mayor_id', String(id));
    } else if (hadMaire && !hasMaire) {
      // Maire removed from this player — clear mayor_id if it pointed to this player
      const currentMayor = getSetting('mayor_id');
      if (currentMayor && Number(currentMayor) === id) {
        setSetting('mayor_id', null);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);

  // If status and/or role changed, update room memberships
  const io = req.app.get('io');
  if (io && (updates.status !== undefined || updates.role !== undefined)) {
    const newStatus = updates.status !== undefined ? updates.status : player.status;
    const newRole = updates.role !== undefined ? updates.role : player.role;
    updatePlayerRooms(io, id, newStatus, newRole);
  }

  // Re-sync the affected player
  if (io) {
    resyncPlayer(io, id);

    // Broadcast updated player list to all interfaces (admin, dashboard, other players)
    const allPlayers = db.prepare('SELECT id, name, status, special_role FROM players ORDER BY id').all();
    const lobbyData = { playerCount: allPlayers.length, players: allPlayers };
    emitToAdmin(io, 'lobby:update', lobbyData);
    emitToDashboard(io, 'lobby:update', lobbyData);
    emitToAll(io, 'lobby:update', lobbyData);
  }

  res.json(updated);
});

router.post('/phase/undo', (req, res) => {
  const { phaseId } = req.body;
  if (!phaseId) {
    return res.status(400).json({ error: 'phaseId requis' });
  }

  const phaseIdNum = Number(phaseId);
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseIdNum);
  if (!phase) {
    return res.status(404).json({ error: 'Phase introuvable' });
  }

  // Revert score changes from this phase
  const scoreChangesJson = getSetting(`score_changes_phase_${phaseIdNum}`);
  if (scoreChangesJson) {
    try {
      const scoreChanges = JSON.parse(scoreChangesJson);
      recordScoreSnapshot('phase_undo_scores', {
        phaseId: phaseIdNum,
        scoreChangesCount: Array.isArray(scoreChanges) ? scoreChanges.length : 0,
      });
      const revertScore = db.prepare('UPDATE players SET score = score - ? WHERE id = ?');
      db.transaction(() => {
        for (const change of scoreChanges) {
          revertScore.run(change.delta, change.playerId);
          recordScoreEvent({
            playerId: change.playerId,
            phaseId: phaseIdNum,
            sourceType: 'phase_undo',
            sourceId: phaseIdNum,
            reason: 'phase_score_reverted',
            delta: -change.delta,
            metadata: { originalReason: change.reason || null },
          }, db);
        }
      })();
      setSetting(`score_changes_phase_${phaseIdNum}`, null);
      logger.score('Phase scores reverted via undo', { phaseId: phaseIdNum, changes: scoreChanges.length });
    } catch (err) {
      logger.error('Could not revert phase scores', { phaseId: phaseIdNum, error: err.message });
    }
  }

  // Revert phase to active state
  db.prepare("UPDATE phases SET status = 'active', timestamp_end = NULL WHERE id = ?").run(phaseIdNum);

  // Restore immunity consumed during phase reveal
  const immunityUsedJson = getSetting(`immunity_used_phase_${phaseIdNum}`);
  if (immunityUsedJson) {
    try {
      const immunityPlayerIds = JSON.parse(immunityUsedJson);
      if (Array.isArray(immunityPlayerIds) && immunityPlayerIds.length > 0) {
        // Re-add 'immunite' to each player's special_role (preserving other roles)
        for (const pid of immunityPlayerIds) {
          const p = db.prepare('SELECT special_role FROM players WHERE id = ?').get(Number(pid));
          const newRole = addSpecialRole(p ? p.special_role : null, 'immunite');
          db.prepare('UPDATE players SET special_role = ? WHERE id = ?').run(newRole, Number(pid));
        }
      }
    } catch (err) {
      logger.error('Could not restore immunity on undo', { phaseId: phaseIdNum, error: err.message });
    }
  }

  // Restore victims from this phase
  const victims = db.prepare('SELECT * FROM phase_victims WHERE phase_id = ?').all(phaseIdNum);
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
  db.prepare('DELETE FROM phase_victims WHERE phase_id = ?').run(phaseIdNum);

  setSetting('current_phase_id', String(phaseIdNum));
  setSetting(`phase_revealed_${phaseIdNum}`, null);
  setSetting(`immunity_used_phase_${phaseIdNum}`, null);

  res.json({ undone: true, phaseId: phaseIdNum, restoredPlayers: victims.length });
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
  // Auto-archive a finished game before wiping it, so it stays reviewable.
  const archiveOnReset = req.body?.archive !== false;
  let archived = null;
  if (archiveOnReset && getSetting('game_status') === 'finished') {
    try {
      archived = archiveGame(req.body?.archiveLabel);
    } catch (err) {
      logger.error('Could not archive game before reset', { error: err.message });
    }
  }

  resetGame();

  // Clear timer settings
  setSetting('timer_duration', null);
  setSetting('timer_started_at', null);

  logger.game('Game reset', { archivedId: archived?.id || null });

  const io = req.app.get('io');
  if (io) {
    emitToAll(io, 'game:reset', {});
  }

  res.json({ reset: true, archived: archived ? { id: archived.id, label: archived.label } : null });
});

// ─── Export / Import / Archives ─────────────────────────────────────────────

router.get('/game/export', (_req, res) => {
  const snapshot = exportGame();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="les-immortels-${stamp}.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

router.post('/game/import', (req, res) => {
  const payload = req.body;

  const validationError = validateSnapshot(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const counts = importGame(payload);

    const io = req.app.get('io');
    if (io) {
      // Every client must rebuild from scratch — the game they were showing
      // no longer exists. game:reset sends players back to the login screen.
      emitToAll(io, 'game:reset', {});
    }

    res.json({ imported: true, counts });
  } catch (err) {
    logger.error('Game import failed', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.get('/archives', (_req, res) => {
  res.json(listArchives());
});

router.get('/archives/:id', (req, res) => {
  const archive = getArchive(req.params.id);
  if (!archive) {
    return res.status(404).json({ error: 'Archive introuvable' });
  }
  res.json(archive);
});

router.post('/archives', (req, res) => {
  try {
    const archive = archiveGame(req.body?.label);
    res.json(archive);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/archives/:id', (req, res) => {
  const deleted = deleteArchive(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Archive introuvable' });
  }
  res.json({ deleted: true, id: Number(req.params.id) });
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
    const valid = isVoteValid(voteType, voter, target);
    const vote = submitVote(Number(phaseId), Number(voterId), Number(targetId), voteType, valid);
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

router.get('/score-snapshots', (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, 500)
    : 100;
  res.json(listScoreSnapshots(limit));
});

router.get('/score-events', (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, 1000)
    : 300;
  res.json(listScoreEvents(limit));
});

router.post('/game/end', (req, res) => {
  const { winner: requestedWinner } = req.body || {};

  // Validate winner if provided
  if (requestedWinner && !['wolves', 'villagers'].includes(requestedWinner)) {
    return res.status(400).json({ error: 'winner invalide. Valeurs acceptées: wolves, villagers' });
  }

  const currentStatus = getSetting('game_status');
  if (currentStatus === 'finished') {
    const existingWinner = getSetting('game_winner') || null;
    return res.json({
      status: 'finished',
      scoreChanges: [],
      scoreboard: getScoreboard(),
      winner: existingWinner,
      alreadyFinished: true,
    });
  }

  setSetting('game_status', 'finished');

  // Determine winner first (needed for final score computation)
  const db = getDb();
  const aliveWolves = db.prepare("SELECT COUNT(*) as count FROM players WHERE role = 'wolf' AND status = 'alive'").get().count;
  const winner = requestedWinner || (aliveWolves > 0 ? 'wolves' : 'villagers');
  setSetting('game_winner', winner);

  logger.game('Game ended', { winner });

  let scoreChanges = [];
  try {
    scoreChanges = computeFinalScores(winner);
    logger.score('Final scores computed', { changes: scoreChanges.length });
  } catch (err) {
    logger.error('Could not compute final scores', { error: err.message });
  }

  const scoreboard = getScoreboard();

  const io = req.app.get('io');
  if (io) {
    emitToAll(io, 'game:end', { scoreboard, winner });
  }

  res.json({ status: 'finished', scoreChanges, scoreboard, winner });
});

export default router;
