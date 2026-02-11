import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { adminAuth } from '../middleware/auth.js';
import { getDb, getAllSettings, getSetting, setSetting, resetGame } from '../db.js';
import {
  assignRoles,
  createPhase,
  startPhase,
  openVoting,
  closeVoting,
  getCurrentPhase,
  getVoteResults,
  getVoteDetails,
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
    io.to('admin').emit('lobby:update', {
      playerCount: db.prepare('SELECT COUNT(*) as count FROM players').get().count,
    });
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
    io.to('admin').emit('lobby:update', {
      playerCount: db.prepare('SELECT COUNT(*) as count FROM players').get().count,
    });
  }

  res.json({ deleted: true, id });
});

router.get('/players', (req, res) => {
  const players = getDb().prepare('SELECT * FROM players ORDER BY id').all();
  res.json(players);
});

router.post('/game/assign-roles', (req, res) => {
  const numWolves = req.body.numWolves ? Number(req.body.numWolves) : Number(getSetting('num_wolves'));

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

  const io = req.app.get('io');
  if (io) {
    // Notify all players the game started
    io.emit('game:started');

    // Send role to each player individually
    const players = db.prepare('SELECT * FROM players').all();
    for (const player of players) {
      io.to(`player:${player.id}`).emit('role:revealed', {
        role: player.role,
      });
    }

    // Reveal wolves to each other after a short delay (after phase 1 per spec,
    // but game:start is the natural moment)
    const wolves = db.prepare("SELECT id, name FROM players WHERE role = 'wolf'").all();
    io.to('wolves').emit('wolves:revealed', { wolves });
  }

  res.json({ status: 'in_progress', playerCount });
});

// ─── Phases ─────────────────────────────────────────────────────────────────

router.post('/phase/create', (req, res) => {
  const { type } = req.body;
  try {
    const phase = createPhase(type);
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

  try {
    const phase = startPhase(Number(phaseId));

    const io = req.app.get('io');
    if (io) {
      io.emit('phase:started', { phase });
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

  try {
    const phase = openVoting(Number(phaseId));

    const io = req.app.get('io');
    if (io) {
      io.emit('phase:voting_opened', { phase });
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

  try {
    const phase = closeVoting(Number(phaseId));

    const io = req.app.get('io');
    if (io) {
      io.emit('phase:voting_closed', { phase });
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

  const eliminated = [];

  // Apply eliminations if provided
  if (victims && Array.isArray(victims)) {
    for (const victim of victims) {
      try {
        const player = eliminatePlayer(victim.playerId, Number(phaseId), victim.eliminatedBy);
        eliminated.push(player);
      } catch (err) {
        // Skip errors (e.g., already eliminated)
        console.warn(`[ADMIN] Could not eliminate player ${victim.playerId}: ${err.message}`);
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
  } catch (err) {
    console.warn(`[ADMIN] Could not compute phase scores: ${err.message}`);
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('phase:result', {
      phase,
      eliminated: eliminated.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        eliminatedBy: p.eliminated_by,
      })),
    });
  }

  // Clear current phase
  setSetting('current_phase_id', null);

  res.json({ phase, eliminated, scoreChanges });
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
    io.emit('speech:order', { order });
  }

  res.json({ order });
});

router.post('/timer/start', (req, res) => {
  const { duration } = req.body;
  if (!duration || typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: 'duration (secondes) requis' });
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('timer:start', { duration });
  }

  res.json({ started: true, duration });
});

// ─── Special powers ─────────────────────────────────────────────────────────

router.post('/special/trigger', (req, res) => {
  const { playerId, power } = req.body;
  if (!playerId || !power) {
    return res.status(400).json({ error: 'playerId et power requis' });
  }

  const db = getDb();
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`player:${player.id}`).emit('special:prompt', {
      power,
      playerId: player.id,
      playerName: player.name,
    });
  }

  res.json({ triggered: true, power, playerId: player.id });
});

router.post('/special/force', (req, res) => {
  const { power, playerId, targetId, decision } = req.body;
  if (!power) {
    return res.status(400).json({ error: 'power requis' });
  }

  const db = getDb();

  try {
    switch (power) {
      case 'protecteur': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        protectPlayer(Number(targetId));
        res.json({ applied: true, power, targetId });
        break;
      }
      case 'sorciere': {
        if (decision === 'resurrect' && targetId) {
          const player = resurrectPlayer(Number(targetId));
          res.json({ applied: true, power, action: 'resurrect', player });
        } else {
          setSetting('witch_used', '1');
          res.json({ applied: true, power, action: 'skip' });
        }
        break;
      }
      case 'voyante': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const target = db.prepare('SELECT id, name, role FROM players WHERE id = ?').get(Number(targetId));
        if (!target) return res.status(404).json({ error: 'Cible introuvable' });

        const remaining = Number(getSetting('seer_uses_remaining') || '0');
        if (remaining > 0) {
          setSetting('seer_uses_remaining', String(remaining - 1));
        }

        // Send result to voyante
        const io2 = req.app.get('io');
        if (io2 && playerId) {
          io2.to(`player:${playerId}`).emit('special:result', {
            power: 'voyante',
            target: { id: target.id, name: target.name, role: target.role },
          });
        }

        res.json({ applied: true, power, target: { id: target.id, name: target.name, role: target.role } });
        break;
      }
      case 'chasseur': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        const currentPhase = getCurrentPhase();
        const phaseId = currentPhase ? currentPhase.id : null;
        const victim = eliminatePlayer(Number(targetId), phaseId, 'chasseur');

        setSetting('hunter_pending', '0');

        const io3 = req.app.get('io');
        if (io3) {
          io3.emit('player:eliminated', {
            player: { id: victim.id, name: victim.name, role: victim.role },
            eliminatedBy: 'chasseur',
          });
        }

        res.json({ applied: true, power, victim });
        break;
      }
      case 'mayor_succession': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        setSetting('mayor_id', String(targetId));
        res.json({ applied: true, power, newMayorId: Number(targetId) });
        break;
      }
      default:
        res.status(400).json({ error: `Pouvoir inconnu: ${power}` });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Challenges ─────────────────────────────────────────────────────────────

router.post('/challenge', (req, res) => {
  const { name, specialRole, winningPlayerIds, afterPhaseId } = req.body;

  if (!name || !specialRole) {
    return res.status(400).json({ error: 'name et specialRole requis' });
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
    io.to(`player:${playerId}`).emit('player:role_assigned', {
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

  const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
  const values = Object.values(updates);

  db.prepare(`UPDATE players SET ${setClauses} WHERE id = ?`).run(...values, id);

  const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
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
  for (const victim of victims) {
    db.prepare(
      "UPDATE players SET status = 'alive', eliminated_at_phase = NULL, eliminated_by = NULL WHERE id = ?"
    ).run(victim.player_id);
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

  const io = req.app.get('io');
  if (io) {
    io.emit('game:reset');
  }

  res.json({ reset: true });
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

  let scoreChanges = [];
  try {
    scoreChanges = computeFinalScores();
  } catch (err) {
    console.warn(`[ADMIN] Could not compute final scores: ${err.message}`);
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('game:end', { scoreboard: getScoreboard() });
  }

  res.json({ status: 'finished', scoreChanges, scoreboard: getScoreboard() });
});

export default router;
