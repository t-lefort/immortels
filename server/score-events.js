import { getDb } from './db.js';

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Record a score movement after the player's score has been updated.
 * Call this inside the same database transaction as the score mutation.
 */
export function recordScoreEvent({
  playerId,
  phaseId = null,
  sourceType,
  sourceId = null,
  reason,
  delta,
  metadata = {},
}, database = getDb()) {
  if (!Number.isInteger(Number(playerId))) throw new Error('Invalid score event playerId');
  if (!Number.isInteger(Number(delta)) || Number(delta) === 0) throw new Error('Invalid score event delta');
  if (!sourceType || !reason) throw new Error('Score event sourceType and reason are required');

  const player = database.prepare(
    'SELECT name, role, status, score FROM players WHERE id = ?'
  ).get(Number(playerId));
  if (!player) throw new Error(`Score event player ${playerId} not found`);

  const numericDelta = Number(delta);
  const scoreAfter = Number(player.score);
  const scoreBefore = scoreAfter - numericDelta;
  const eventMetadata = {
    ...(metadata || {}),
    playerNameAtEvent: player.name,
    playerRoleAtEvent: player.role,
    playerStatusAtEvent: player.status,
  };

  const result = database.prepare(`
    INSERT INTO score_events (
      player_id, phase_id, source_type, source_id, reason,
      delta, score_before, score_after, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(playerId),
    phaseId == null ? null : Number(phaseId),
    String(sourceType),
    sourceId == null ? null : String(sourceId),
    String(reason),
    numericDelta,
    scoreBefore,
    scoreAfter,
    JSON.stringify(eventMetadata)
  );

  return {
    id: Number(result.lastInsertRowid),
    playerId: Number(playerId),
    phaseId: phaseId == null ? null : Number(phaseId),
    sourceType: String(sourceType),
    sourceId: sourceId == null ? null : String(sourceId),
    reason: String(reason),
    delta: numericDelta,
    scoreBefore,
    scoreAfter,
    metadata: eventMetadata,
  };
}

export function listScoreEvents(limit = 300) {
  const rows = getDb().prepare(`
    SELECT
      se.id, se.player_id, se.phase_id, se.source_type, se.source_id,
      se.reason, se.delta, se.score_before, se.score_after,
      se.metadata_json, se.created_at,
      p.name AS player_name, p.role AS player_role, p.status AS player_status
    FROM score_events se
    JOIN players p ON p.id = se.player_id
    ORDER BY se.id DESC
    LIMIT ?
  `).all(limit);

  return rows.map(row => {
    const metadata = parseJson(row.metadata_json, {});
    return {
      id: row.id,
      playerId: row.player_id,
      playerName: metadata.playerNameAtEvent || row.player_name,
      playerRole: metadata.playerRoleAtEvent || row.player_role,
      playerStatus: metadata.playerStatusAtEvent || row.player_status,
      phaseId: row.phase_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      reason: row.reason,
      delta: row.delta,
      scoreBefore: row.score_before,
      scoreAfter: row.score_after,
      metadata,
      createdAt: row.created_at,
    };
  });
}
