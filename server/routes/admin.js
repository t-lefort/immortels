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
import {
  emitToPlayer,
  emitToWolves,
  emitToAll,
  emitToAdmin,
  emitToDashboard,
  updatePlayerRooms,
} from '../socket-rooms.js';
import { resyncPlayer } from '../socket-handlers.js';

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

  try {
    const phase = closeVoting(Number(phaseId));

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

  // Apply eliminations if provided
  if (victims && Array.isArray(victims)) {
    for (const victim of victims) {
      try {
        const player = eliminatePlayer(victim.playerId, Number(phaseId), victim.eliminatedBy);
        eliminated.push(player);

        // Update room membership: player becomes ghost
        if (io) {
          updatePlayerRooms(io, victim.playerId, 'ghost');
        }
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
        setSetting('hunter_pending', '1');
        emitToPlayer(io, p.id, 'special:prompt', {
          power: 'chasseur',
          playerId: p.id,
          playerName: p.name,
        });
        emitToAdmin(io, 'special:prompt', {
          power: 'chasseur',
          playerId: p.id,
          playerName: p.name,
        });
      }
    }

    // Check if mayor was eliminated — trigger succession
    const mayorIdStr = getSetting('mayor_id');
    if (mayorIdStr) {
      const mayorId = Number(mayorIdStr);
      const eliminatedMayor = eliminated.find(p => p.id === mayorId);
      if (eliminatedMayor) {
        emitToPlayer(io, mayorId, 'special:prompt', {
          power: 'mayor_succession',
          playerId: mayorId,
          playerName: eliminatedMayor.name,
        });
        emitToAdmin(io, 'special:prompt', {
          power: 'mayor_succession',
          playerId: mayorId,
          playerName: eliminatedMayor.name,
        });
      }
    }
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
    emitToAll(io, 'speech:order', { order });
  }

  res.json({ order });
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
    emitToPlayer(io, player.id, 'special:prompt', {
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
  const io = req.app.get('io');

  try {
    switch (power) {
      case 'protecteur': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        protectPlayer(Number(targetId));

        if (io && playerId) {
          emitToPlayer(io, playerId, 'special:result', {
            power: 'protecteur',
            targetId: Number(targetId),
          });
        }

        res.json({ applied: true, power, targetId });
        break;
      }
      case 'sorciere': {
        if (decision === 'resurrect' && targetId) {
          const player = resurrectPlayer(Number(targetId));

          // Update room membership: player is alive again
          if (io) {
            updatePlayerRooms(io, Number(targetId), 'alive');
          }

          if (io && playerId) {
            emitToPlayer(io, playerId, 'special:result', {
              power: 'sorciere',
              action: 'resurrect',
              target: { id: player.id, name: player.name },
            });
          }

          res.json({ applied: true, power, action: 'resurrect', player });
        } else {
          setSetting('witch_used', '1');

          if (io && playerId) {
            emitToPlayer(io, playerId, 'special:result', {
              power: 'sorciere',
              action: 'skip',
            });
          }

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
        if (io && playerId) {
          emitToPlayer(io, playerId, 'special:result', {
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

        // Update room membership: victim becomes ghost
        if (io) {
          updatePlayerRooms(io, Number(targetId), 'ghost');

          // Broadcast elimination to all
          emitToAll(io, 'player:eliminated', {
            player: { id: victim.id, name: victim.name, role: victim.role },
            eliminatedBy: 'chasseur',
          });

          // Notify the specific victim
          emitToPlayer(io, victim.id, 'player:eliminated', {
            playerId: victim.id,
          });

          // Send result to hunter
          if (playerId) {
            emitToPlayer(io, playerId, 'special:result', {
              power: 'chasseur',
              victim: { id: victim.id, name: victim.name },
            });
          }
        }

        res.json({ applied: true, power, victim });
        break;
      }
      case 'mayor_succession': {
        if (!targetId) return res.status(400).json({ error: 'targetId requis' });
        setSetting('mayor_id', String(targetId));

        if (io && playerId) {
          emitToPlayer(io, playerId, 'special:result', {
            power: 'mayor_succession',
            newMayorId: Number(targetId),
          });
        }

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

  const io = req.app.get('io');
  if (io) {
    emitToAll(io, 'game:reset', {});
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
