import { getDb } from './db.js';
import logger from './logger.js';

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Capture a full score snapshot (best effort).
 * Snapshot is stored before score mutations to simplify recovery/audits.
 */
export function recordScoreSnapshot(reason, context = {}) {
  try {
    const db = getDb();
    const scores = db.prepare(
      'SELECT id, name, role, special_role, status, score FROM players ORDER BY score DESC, name ASC'
    ).all();

    const result = db.prepare(
      'INSERT INTO score_snapshots (reason, context_json, scores_json) VALUES (?, ?, ?)'
    ).run(
      String(reason || 'unknown'),
      JSON.stringify(context || {}),
      JSON.stringify(scores)
    );

    return Number(result.lastInsertRowid);
  } catch (err) {
    logger.error('Could not record score snapshot', { reason, error: err.message });
    return null;
  }
}

/**
 * Return latest score snapshots (newest first).
 */
export function listScoreSnapshots(limit = 100) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, created_at, reason, context_json, scores_json FROM score_snapshots ORDER BY id DESC LIMIT ?'
  ).all(limit);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    reason: row.reason,
    context: parseJson(row.context_json, {}),
    scores: parseJson(row.scores_json, []),
  }));
}
