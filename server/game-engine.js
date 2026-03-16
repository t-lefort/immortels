import { getDb, getSetting, setSetting } from './db.js';
import logger from './logger.js';
import { recordScoreSnapshot } from './score-snapshots.js';
import { sqlHasRole } from './role-helpers.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates (Knuth) shuffle — returns a new shuffled array.
 */
function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tally votes by target_id.
 * Returns sorted array [{ targetId, count }] descending by count.
 */
function tallyVotes(votes) {
  const counts = {};
  for (const vote of votes) {
    if (vote.target_id == null) continue;
    counts[vote.target_id] = (counts[vote.target_id] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([targetId, count]) => ({ targetId: Number(targetId), count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Setup ──────────────────────────────────────────────────────────────────

/**
 * Randomly assign wolf/villager roles using Fisher-Yates shuffle.
 * First numWolves players after shuffle become wolves, rest are villagers.
 */
export function assignRoles(numWolves) {
  const db = getDb();
  const players = db.prepare('SELECT id FROM players ORDER BY id').all();

  if (players.length === 0) {
    throw new Error('No players registered');
  }
  if (numWolves >= players.length) {
    throw new Error(`Cannot assign ${numWolves} wolves among ${players.length} players`);
  }

  const shuffled = fisherYatesShuffle(players);

  const assignRole = db.prepare('UPDATE players SET role = ? WHERE id = ?');
  db.transaction(() => {
    for (let i = 0; i < shuffled.length; i++) {
      const role = i < numWolves ? 'wolf' : 'villager';
      assignRole.run(role, shuffled[i].id);
    }
  })();

  const result = db.prepare('SELECT id, name, role FROM players ORDER BY id').all();
  const wolves = result.filter(p => p.role === 'wolf');
  logger.game('Roles assigned', { totalPlayers: result.length, numWolves: wolves.length });
  return result;
}

// ─── Phase Management ───────────────────────────────────────────────────────

/**
 * Create a new phase with status 'pending'.
 */
export function createPhase(type) {
  if (type !== 'night' && type !== 'village_council') {
    throw new Error(`Invalid phase type: ${type}`);
  }

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO phases (type, status) VALUES (?, 'pending')"
  ).run(type);

  return db.prepare('SELECT * FROM phases WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Start a pending phase: pending → active.
 * Sets current_phase_id in game_settings.
 */
export function startPhase(id) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(id);

  if (!phase) throw new Error(`Phase ${id} not found`);
  if (phase.status !== 'pending') {
    throw new Error(`Phase ${id} is '${phase.status}', expected 'pending'`);
  }

  db.prepare(
    "UPDATE phases SET status = 'active', timestamp_start = datetime('now') WHERE id = ?"
  ).run(id);
  setSetting('current_phase_id', String(id));

  return db.prepare('SELECT * FROM phases WHERE id = ?').get(id);
}

/**
 * Open voting on an active phase: active → voting.
 */
export function openVoting(id) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(id);

  if (!phase) throw new Error(`Phase ${id} not found`);
  if (phase.status !== 'active') {
    throw new Error(`Phase ${id} is '${phase.status}', expected 'active'`);
  }

  db.prepare("UPDATE phases SET status = 'voting' WHERE id = ?").run(id);

  return db.prepare('SELECT * FROM phases WHERE id = ?').get(id);
}

/**
 * Close voting: voting → completed. Records timestamp_end.
 * For night phases, also resolves ghost identification correctness.
 */
export function closeVoting(id) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(id);

  if (!phase) throw new Error(`Phase ${id} not found`);
  if (phase.status !== 'voting') {
    throw new Error(`Phase ${id} is '${phase.status}', expected 'voting'`);
  }

  db.prepare(
    "UPDATE phases SET status = 'completed', timestamp_end = datetime('now') WHERE id = ?"
  ).run(id);

  // Resolve ghost identifications for night phases
  if (phase.type === 'night') {
    resolveGhostIdentifications(id);
  }

  return db.prepare('SELECT * FROM phases WHERE id = ?').get(id);
}

/**
 * Get the current phase (from current_phase_id setting), or null.
 */
export function getCurrentPhase() {
  const currentPhaseId = getSetting('current_phase_id');
  if (!currentPhaseId) return null;
  return getDb().prepare('SELECT * FROM phases WHERE id = ?').get(Number(currentPhaseId)) || null;
}

// ─── Votes ──────────────────────────────────────────────────────────────────

/**
 * Submit a vote. Deduplicates: one vote per (phase, voter, voteType).
 * If the player already voted, updates their existing vote (upsert).
 * Returns { vote, updated } where updated=true if an existing vote was changed.
 */
export function submitVote(phaseId, voterId, targetId, voteType) {
  const db = getDb();

  const existing = db.prepare(
    'SELECT id, target_id FROM votes WHERE phase_id = ? AND voter_id = ? AND vote_type = ?'
  ).get(phaseId, voterId, voteType);

  if (existing) {
    // Upsert: update the existing vote with the new target
    db.prepare(
      'UPDATE votes SET target_id = ? WHERE id = ?'
    ).run(targetId, existing.id);

    const updated = db.prepare('SELECT * FROM votes WHERE id = ?').get(existing.id);
    return { ...updated, updated: true };
  }

  const result = db.prepare(
    'INSERT INTO votes (phase_id, voter_id, target_id, vote_type, is_valid) VALUES (?, ?, ?, ?, 1)'
  ).run(phaseId, voterId, targetId, voteType);

  const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(result.lastInsertRowid);
  return { ...vote, updated: false };
}

/**
 * Submit ghost identifications (batch). One ghost can identify multiple targets.
 * Deduplicates: clears previous identifications for this ghost+phase before inserting.
 */
export function submitGhostIdentifications(phaseId, ghostId, targetIds) {
  const db = getDb();

  db.transaction(() => {
    // Clear previous identifications for this ghost in this phase
    db.prepare(
      'DELETE FROM ghost_identifications WHERE phase_id = ? AND ghost_id = ?'
    ).run(phaseId, ghostId);

    // Insert new identifications (target_is_wolf computed at vote close)
    const insert = db.prepare(
      'INSERT INTO ghost_identifications (phase_id, ghost_id, target_id, target_is_wolf) VALUES (?, ?, ?, 0)'
    );
    for (const targetId of targetIds) {
      insert.run(phaseId, ghostId, targetId);
    }
  })();

  return db.prepare(
    'SELECT * FROM ghost_identifications WHERE phase_id = ? AND ghost_id = ?'
  ).all(phaseId, ghostId);
}

/**
 * Get tallied vote results for a phase and vote type.
 * Returns sorted array: [{ targetId, targetName, count }] descending.
 */
export function getVoteResults(phaseId, voteType) {
  const db = getDb();

  const votes = db.prepare(
    'SELECT target_id FROM votes WHERE phase_id = ? AND vote_type = ? AND is_valid = 1 AND target_id IS NOT NULL'
  ).all(phaseId, voteType);

  const tally = tallyVotes(votes);

  const getPlayer = db.prepare('SELECT id, name FROM players WHERE id = ?');
  return tally.map(({ targetId, count }) => {
    const player = getPlayer.get(targetId);
    return { targetId, targetName: player ? player.name : '?', count };
  });
}

/**
 * Get detailed vote breakdown for admin view.
 */
export function getVoteDetails(phaseId) {
  const db = getDb();

  return db.prepare(`
    SELECT
      v.id,
      v.vote_type,
      v.is_valid,
      v.voter_id,
      voter.name  AS voter_name,
      voter.role  AS voter_role,
      v.target_id,
      target.name AS target_name,
      target.role AS target_role
    FROM votes v
    JOIN players voter  ON v.voter_id = voter.id
    LEFT JOIN players target ON v.target_id = target.id
    WHERE v.phase_id = ?
    ORDER BY v.vote_type, v.id
  `).all(phaseId);
}

// ─── Ghost Identification Resolution ────────────────────────────────────────

/**
 * Resolve ghost identifications: set target_is_wolf based on actual player roles.
 * Called automatically by closeVoting for night phases.
 */
function resolveGhostIdentifications(phaseId) {
  const db = getDb();

  const identifications = db.prepare(
    'SELECT gi.id, p.role FROM ghost_identifications gi JOIN players p ON gi.target_id = p.id WHERE gi.phase_id = ?'
  ).all(phaseId);

  const update = db.prepare(
    'UPDATE ghost_identifications SET target_is_wolf = ? WHERE id = ?'
  );

  db.transaction(() => {
    for (const ident of identifications) {
      update.run(ident.role === 'wolf' ? 1 : 0, ident.id);
    }
  })();
}

// ─── Night Resolution ───────────────────────────────────────────────────────

/**
 * Resolve a night phase. Returns resolution data for admin review.
 * Does NOT apply eliminations — admin validates first.
 */
export function resolveNight(phaseId) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseId);

  if (!phase || phase.type !== 'night') {
    throw new Error(`Phase ${phaseId} is not a night phase`);
  }

  // Ensure ghost identifications are resolved before reading them.
  // resolveGhostIdentifications is idempotent — it re-computes target_is_wolf
  // from actual player roles every time, so it's safe to call multiple times.
  // This fixes a bug where target_is_wolf remained 0 (the default) when
  // results were fetched before closeVoting had been called.
  resolveGhostIdentifications(phaseId);

  // --- Wolf votes ---
  const wolfResults = getVoteResults(phaseId, 'wolf');
  let wolfVictim = null;
  let wolfVoteTie = false;

  let wolfTiedPlayers = [];

  if (wolfResults.length > 0) {
    if (wolfResults.length > 1 && wolfResults[0].count === wolfResults[1].count) {
      wolfVoteTie = true;
      wolfTiedPlayers = wolfResults
        .filter(r => r.count === wolfResults[0].count)
        .map(r => ({ targetId: r.targetId, targetName: r.targetName, count: r.count }));
    } else {
      wolfVictim = { id: wolfResults[0].targetId, name: wolfResults[0].targetName };
    }
  }

  // --- Ghost votes ---
  const ghostResults = getVoteResults(phaseId, 'ghost_eliminate');
  let ghostVictim = null;

  if (ghostResults.length > 0) {
    if (ghostResults.length > 1 && ghostResults[0].count === ghostResults[1].count) {
      // Tie among ghosts → deterministic pick (lowest player ID for idempotent results)
      const tiedTargets = ghostResults.filter(r => r.count === ghostResults[0].count);
      tiedTargets.sort((a, b) => a.targetId - b.targetId);
      ghostVictim = { id: tiedTargets[0].targetId, name: tiedTargets[0].targetName };
    } else {
      ghostVictim = { id: ghostResults[0].targetId, name: ghostResults[0].targetName };
    }
  }

  // --- Protection check ---
  const protectedPlayerIdStr = getSetting('protected_player_id');
  const protectedPlayerId = protectedPlayerIdStr ? Number(protectedPlayerIdStr) : null;

  const wolfVictimProtected = !!(wolfVictim && protectedPlayerId === wolfVictim.id);
  const ghostVictimProtected = !!(ghostVictim && protectedPlayerId === ghostVictim.id);

  // --- Ghost identifications summary ---
  const ghostIdentifications = db.prepare(`
    SELECT
      gi.ghost_id,
      g.name AS ghost_name,
      gi.target_id,
      t.name AS target_name,
      gi.target_is_wolf
    FROM ghost_identifications gi
    JOIN players g ON gi.ghost_id = g.id
    JOIN players t ON gi.target_id = t.id
    WHERE gi.phase_id = ?
  `).all(phaseId);

  return {
    wolfResults,
    wolfVictim,
    wolfVoteTie,
    wolfTiedPlayers,
    ghostResults,
    ghostVictim,
    protectedPlayerId,
    wolfVictimProtected,
    ghostVictimProtected,
    ghostIdentifications,
  };
}

// ─── Village Council Resolution ─────────────────────────────────────────────

/**
 * Resolve a village council phase. Handles mayor double vote, immunity, ties.
 * Does NOT apply elimination — admin validates first.
 */
export function resolveVillageCouncil(phaseId) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseId);

  if (!phase || phase.type !== 'village_council') {
    throw new Error(`Phase ${phaseId} is not a village_council phase`);
  }

  // Get raw valid votes
  const votes = db.prepare(
    "SELECT * FROM votes WHERE phase_id = ? AND vote_type = 'village' AND is_valid = 1 AND target_id IS NOT NULL"
  ).all(phaseId);

  // Tally with mayor double vote — look up directly from players table
  const srM = sqlHasRole('maire');
  const mayor = db.prepare(`SELECT id FROM players WHERE ${srM.clause} AND status = 'alive'`).get(...srM.params);
  const mayorId = mayor ? mayor.id : null;

  const counts = {};
  for (const vote of votes) {
    const weight = (mayorId && vote.voter_id === mayorId) ? 2 : 1;
    counts[vote.target_id] = (counts[vote.target_id] || 0) + weight;
  }

  const getPlayer = db.prepare('SELECT id, name, role, special_role FROM players WHERE id = ?');

  const results = Object.entries(counts)
    .map(([targetId, count]) => {
      const player = getPlayer.get(Number(targetId));
      return {
        targetId: Number(targetId),
        targetName: player?.name || '?',
        targetRole: player?.role,
        targetSpecialRole: player?.special_role,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  if (results.length === 0) {
    return { results, victim: null, tie: false, tiedPlayers: [] };
  }

  // Check for tie
  const topCount = results[0].count;
  const tiedPlayers = results.filter(r => r.count === topCount);

  if (tiedPlayers.length > 1) {
    // Never auto-resolve ties — admin must choose (mayor's decision or admin's decision)
    if (mayorId) {
      return { results, victim: null, tie: true, tiedPlayers, tieBreaker: 'mayor' };
    }
    // No mayor set — admin decides directly
    return { results, victim: null, tie: true, tiedPlayers, tieBreaker: 'admin' };
  }

  // Single winner — check immunity
  const target = results[0];
  if (target.targetSpecialRole === 'immunite') {
    return { results, victim: null, tie: false, immune: true, immunePlayer: target };
  }

  return { results, victim: target, tie: false };
}

// ─── Speech Order ───────────────────────────────────────────────────────────

/**
 * Generate a random speech order from alive players.
 */
export function generateSpeechOrder() {
  const db = getDb();
  const alivePlayers = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive' ORDER BY id"
  ).all();
  return fisherYatesShuffle(alivePlayers);
}

// ─── Player State Changes ───────────────────────────────────────────────────

/**
 * Eliminate a player: set status to 'ghost', record phase and cause.
 * Also inserts a phase_victims record.
 */
export function eliminatePlayer(playerId, phaseId, eliminatedBy) {
  const db = getDb();

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (player.status !== 'alive') {
    throw new Error(`Player ${playerId} is already '${player.status}'`);
  }

  db.transaction(() => {
    db.prepare(
      "UPDATE players SET status = 'ghost', eliminated_at_phase = ?, eliminated_by = ? WHERE id = ?"
    ).run(phaseId, eliminatedBy, playerId);

    db.prepare(
      'INSERT INTO phase_victims (phase_id, player_id, eliminated_by, was_protected, was_resurrected) VALUES (?, ?, ?, 0, 0)'
    ).run(phaseId, playerId, eliminatedBy);
  })();

  const eliminated = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  logger.game('Player eliminated', { playerId, playerName: eliminated.name, eliminatedBy, phaseId });
  return eliminated;
}

/**
 * Set protection for a player this night.
 * Updates both current and last protected player settings.
 */
export function protectPlayer(playerId) {
  const current = getSetting('protected_player_id');
  setSetting('last_protected_player_id', current);
  setSetting('protected_player_id', String(playerId));
}

/**
 * Clear protection (no one protected this night).
 */
export function clearProtection() {
  const current = getSetting('protected_player_id');
  setSetting('last_protected_player_id', current);
  setSetting('protected_player_id', null);
}

/**
 * Resurrect a player (sorcière power).
 * Restores status to 'alive' and marks witch_used.
 */
export function resurrectPlayer(playerId) {
  const db = getDb();

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);

  db.transaction(() => {
    db.prepare(
      "UPDATE players SET status = 'alive', eliminated_at_phase = NULL, eliminated_by = NULL WHERE id = ?"
    ).run(playerId);

    // Mark the most recent phase_victim record as resurrected
    const lastVictimRecord = db.prepare(
      'SELECT id FROM phase_victims WHERE player_id = ? ORDER BY id DESC LIMIT 1'
    ).get(playerId);

    if (lastVictimRecord) {
      db.prepare(
        'UPDATE phase_victims SET was_resurrected = 1 WHERE id = ?'
      ).run(lastVictimRecord.id);
    }

    setSetting('witch_used', '1');
  })();

  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Compute and apply scores for a completed phase.
 * Returns an array of { playerId, playerName, delta, reason } entries.
 */
export function computePhaseScores(phaseId) {
  const db = getDb();
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(phaseId);
  if (!phase) throw new Error(`Phase ${phaseId} not found`);

  recordScoreSnapshot('phase_scores', { phaseId, phaseType: phase.type });

  const changes = [];
  const addScore = db.prepare('UPDATE players SET score = score + ? WHERE id = ?');

  db.transaction(() => {
    if (phase.type === 'night') {
      computeNightScores(db, phaseId, changes, addScore);
    } else if (phase.type === 'village_council') {
      computeCouncilScores(db, phaseId, changes, addScore);
    }
  })();

  return changes;
}

/**
 * Night scoring rules:
 * - Villager guess: +1 if target is actually a villager
 * - Ghost villager identifies wolf: +1 per correct identification
 * - Ghost villager wrong: -1 per incorrect identification
 * - Ghost wolf: +3 if voted for the ghost-eliminated villager
 */
function computeNightScores(db, phaseId, changes, addScore) {
  // --- Villager guess scoring ---
  const guesses = db.prepare(`
    SELECT v.voter_id, voter.name AS voter_name, target.role AS target_role
    FROM votes v
    JOIN players voter  ON v.voter_id = voter.id
    JOIN players target ON v.target_id = target.id
    WHERE v.phase_id = ? AND v.vote_type = 'villager_guess' AND v.is_valid = 1 AND v.target_id IS NOT NULL
  `).all(phaseId);

  for (const guess of guesses) {
    if (guess.target_role === 'villager') {
      addScore.run(1, guess.voter_id);
      changes.push({ playerId: guess.voter_id, playerName: guess.voter_name, delta: 1, reason: 'villager_guess_correct' });
    }
  }

  // --- Ghost identification scoring ---
  const identifications = db.prepare(`
    SELECT gi.ghost_id, g.name AS ghost_name, g.role AS ghost_role, gi.target_is_wolf
    FROM ghost_identifications gi
    JOIN players g ON gi.ghost_id = g.id
    WHERE gi.phase_id = ?
  `).all(phaseId);

  for (const ident of identifications) {
    // Only villager ghosts score from identifications
    if (ident.ghost_role !== 'villager') continue;

    if (ident.target_is_wolf) {
      addScore.run(1, ident.ghost_id);
      changes.push({ playerId: ident.ghost_id, playerName: ident.ghost_name, delta: 1, reason: 'ghost_identified_wolf' });
    } else {
      addScore.run(-1, ident.ghost_id);
      changes.push({ playerId: ident.ghost_id, playerName: ident.ghost_name, delta: -1, reason: 'ghost_identified_wrong' });
    }
  }

  // --- Ghost wolf bonus: +3 for wolf ghosts who voted for the eliminated villager ---
  const ghostVictim = db.prepare(`
    SELECT pv.player_id, p.role AS victim_role
    FROM phase_victims pv
    JOIN players p ON pv.player_id = p.id
    WHERE pv.phase_id = ? AND pv.eliminated_by = 'ghosts' AND pv.was_protected = 0 AND pv.was_resurrected = 0
  `).get(phaseId);

  if (ghostVictim && ghostVictim.victim_role === 'villager') {
    // Only wolf ghosts who voted for this specific victim get +3
    const wolfGhostsWhoVoted = db.prepare(`
      SELECT p.id, p.name FROM votes v
      JOIN players p ON v.voter_id = p.id
      WHERE v.phase_id = ? AND v.vote_type = 'ghost_eliminate' AND v.target_id = ? AND v.is_valid = 1
        AND p.role = 'wolf' AND p.status = 'ghost'
    `).all(phaseId, ghostVictim.player_id);

    for (const gw of wolfGhostsWhoVoted) {
      addScore.run(3, gw.id);
      changes.push({ playerId: gw.id, playerName: gw.name, delta: 3, reason: 'ghost_wolf_eliminated_villager' });
    }
  }
}

/**
 * Village council scoring rules:
 * - Villager voted for a wolf: +2 (even if the wolf isn't eliminated)
 * - Wolf survived the council: +2
 */
function computeCouncilScores(db, phaseId, changes, addScore) {
  // --- Villagers who voted for a wolf: +2 ---
  const villagerWolfVotes = db.prepare(`
    SELECT v.voter_id, voter.name AS voter_name
    FROM votes v
    JOIN players voter  ON v.voter_id = voter.id
    JOIN players target ON v.target_id = target.id
    WHERE v.phase_id = ? AND v.vote_type = 'village' AND v.is_valid = 1
      AND voter.role = 'villager'
      AND target.role = 'wolf'
  `).all(phaseId);

  for (const vote of villagerWolfVotes) {
    addScore.run(2, vote.voter_id);
    changes.push({ playerId: vote.voter_id, playerName: vote.voter_name, delta: 2, reason: 'villager_voted_wolf' });
  }

  // --- Wolves who survived the council: +2 ---
  const survivingWolves = db.prepare(`
    SELECT id, name FROM players WHERE role = 'wolf' AND status = 'alive'
  `).all();

  for (const wolf of survivingWolves) {
    addScore.run(2, wolf.id);
    changes.push({ playerId: wolf.id, playerName: wolf.name, delta: 2, reason: 'wolf_survived_council' });
  }
}

/**
 * Compute and apply challenge scores.
 * +1 for each player in the winning team (alive or ghost).
 */
export function computeChallengeScores(challengeId) {
  const db = getDb();
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!challenge) throw new Error(`Challenge ${challengeId} not found`);

  recordScoreSnapshot('challenge_scores', { challengeId });

  let winningPlayerIds;
  try {
    winningPlayerIds = JSON.parse(challenge.winning_team_player_ids);
  } catch {
    winningPlayerIds = [];
  }

  if (!Array.isArray(winningPlayerIds) || winningPlayerIds.length === 0) {
    return [];
  }

  const changes = [];
  const addScore = db.prepare('UPDATE players SET score = score + 1 WHERE id = ?');
  const getPlayer = db.prepare('SELECT id, name, status FROM players WHERE id = ?');

  db.transaction(() => {
    for (const playerId of winningPlayerIds) {
      const player = getPlayer.get(playerId);
      if (player) {
        addScore.run(playerId);
        changes.push({ playerId, playerName: player.name, delta: 1, reason: 'challenge_winner' });
      }
    }
  })();

  return changes;
}

/**
 * Compute and apply final scores: +3 for each surviving player of the winning team.
 * @param {string} winner - 'wolves' or 'villagers'
 */
export function computeFinalScores(winner) {
  const db = getDb();
  recordScoreSnapshot('final_scores', { winner });
  const winningRole = winner === 'wolves' ? 'wolf' : 'villager';
  const survivors = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive' AND role = ?"
  ).all(winningRole);

  const changes = [];
  const addScore = db.prepare('UPDATE players SET score = score + 3 WHERE id = ?');

  db.transaction(() => {
    for (const player of survivors) {
      addScore.run(player.id);
      changes.push({ playerId: player.id, playerName: player.name, delta: 3, reason: 'survivor' });
    }
  })();

  return changes;
}

/**
 * Get the full scoreboard sorted by score descending.
 */
export function getScoreboard() {
  return getDb()
    .prepare('SELECT id, name, role, special_role, status, score FROM players ORDER BY score DESC, name ASC')
    .all();
}
