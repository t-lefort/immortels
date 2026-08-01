import { getDb, getAllSettings, GAME_TABLES } from './db.js';
import logger from './logger.js';

/**
 * Game serialization: export / import / archive.
 *
 * Two flavours of snapshot are produced from the same reader:
 *  - `exportGame()`  — full fidelity, admin only. Includes credentials and
 *                      session tokens so an import restores a playable game.
 *  - `archiveGame()` — sanitized, readable by players once the game is over.
 *                      Credentials and session tokens are stripped.
 */

export const EXPORT_VERSION = 1;

// Order matters on import: parents before children (foreign keys are ON).
const TABLE_INSERT_ORDER = [
  'players',
  'phases',
  'phase_victims',
  'votes',
  'ghost_identifications',
  'challenges',
  'score_snapshots',
  'score_events',
];

const SENSITIVE_PLAYER_FIELDS = ['session_token', 'password_hash', 'username'];

function readTable(db, table) {
  return db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
}

/**
 * Read the whole current game into a plain object.
 * @param {{ includeSensitive?: boolean }} options
 */
export function readGameSnapshot({ includeSensitive = true } = {}) {
  const db = getDb();
  const tables = {};

  for (const table of TABLE_INSERT_ORDER) {
    tables[table] = readTable(db, table);
  }

  if (!includeSensitive) {
    tables.players = tables.players.map((player) => {
      const copy = { ...player };
      for (const field of SENSITIVE_PLAYER_FIELDS) delete copy[field];
      return copy;
    });
  }

  const settings = getAllSettings();
  if (!includeSensitive) {
    delete settings.admin_password;
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    tables,
  };
}

/**
 * Full-fidelity export for the admin "Exporter la partie" button.
 */
export function exportGame() {
  return readGameSnapshot({ includeSensitive: true });
}

/**
 * Validate an uploaded payload before touching the database.
 * Returns an error message (French) or null.
 */
export function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Fichier invalide : contenu illisible.';
  }
  if (payload.version !== EXPORT_VERSION) {
    return `Version de sauvegarde non supportée (attendu ${EXPORT_VERSION}, reçu ${payload.version ?? 'aucune'}).`;
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    return 'Fichier invalide : section "tables" manquante.';
  }
  if (!Array.isArray(payload.tables.players)) {
    return 'Fichier invalide : liste des joueurs manquante.';
  }
  if (payload.settings && typeof payload.settings !== 'object') {
    return 'Fichier invalide : section "settings" illisible.';
  }
  for (const table of TABLE_INSERT_ORDER) {
    const rows = payload.tables[table];
    if (rows !== undefined && !Array.isArray(rows)) {
      return `Fichier invalide : la table "${table}" n'est pas une liste.`;
    }
  }
  return null;
}

/**
 * Insert rows into `table`, keeping only columns that actually exist so an
 * older export stays importable after a schema change.
 */
function insertRows(db, table, rows) {
  if (!rows || rows.length === 0) return 0;

  const knownColumns = new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
  );

  let inserted = 0;
  for (const row of rows) {
    const columns = Object.keys(row).filter(c => knownColumns.has(c));
    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(c => {
      const value = row[c];
      // SQLite only stores primitives; anything else is a corrupted export.
      if (value === null || value === undefined) return null;
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value;
    });

    db.prepare(
      `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`
    ).run(...values);
    inserted++;
  }
  return inserted;
}

/**
 * Replace the current game with the contents of `payload`.
 * Everything happens in a single transaction: a malformed row rolls the whole
 * import back rather than leaving a half-replaced game behind.
 */
export function importGame(payload) {
  const validationError = validateSnapshot(payload);
  if (validationError) throw new Error(validationError);

  const db = getDb();
  const counts = {};

  // Foreign keys are deferred for the duration of the import: rows are
  // inserted parent-first, but a partially-consistent export shouldn't abort
  // mid-way and leave the database wiped.
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of [...GAME_TABLES]) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      db.prepare('DELETE FROM game_settings').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name != 'archived_games'").run();

      for (const table of TABLE_INSERT_ORDER) {
        counts[table] = insertRows(db, table, payload.tables[table]);
      }

      const setSettingStmt = db.prepare(
        'INSERT INTO game_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      for (const [key, value] of Object.entries(payload.settings || {})) {
        setSettingStmt.run(key, value === null || value === undefined ? null : String(value));
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  logger.game('Game imported', counts);
  return counts;
}

// ─── Archives ───────────────────────────────────────────────────────────────

/**
 * Archive the current game so it can be reviewed after a reset.
 * Stores a sanitized snapshot (no credentials, no session tokens).
 */
export function archiveGame(label) {
  const db = getDb();
  const settings = getAllSettings();
  const snapshot = readGameSnapshot({ includeSensitive: false });

  const playerCount = snapshot.tables.players.length;
  if (playerCount === 0) {
    throw new Error('Aucune partie à archiver.');
  }

  const cleanLabel = String(label || '').trim()
    || `Partie du ${new Date().toLocaleDateString('fr-FR')}`;

  const gameStatus = settings.game_status || 'finished';

  const result = db.prepare(
    'INSERT INTO archived_games (label, winner, game_status, data_json) VALUES (?, ?, ?, ?)'
  ).run(cleanLabel, settings.game_winner || null, gameStatus, JSON.stringify(snapshot));

  logger.game('Game archived', {
    archiveId: Number(result.lastInsertRowid),
    label: cleanLabel,
    playerCount,
    gameStatus,
  });
  return getArchive(Number(result.lastInsertRowid));
}

/**
 * List archives without their payload (cheap enough to poll).
 *
 * `finishedOnly` is what the player-facing endpoints pass: a mid-game safety
 * archive contains every role of the game in progress.
 */
export function listArchives({ finishedOnly = false } = {}) {
  const where = finishedOnly ? "WHERE game_status = 'finished'" : '';
  return getDb()
    .prepare(`SELECT id, label, winner, game_status, archived_at FROM archived_games ${where} ORDER BY id DESC`)
    .all()
    .map(row => ({
      id: row.id,
      label: row.label,
      winner: row.winner,
      gameStatus: row.game_status,
      archivedAt: row.archived_at,
    }));
}

/**
 * Load one archive, parsed and shaped for display.
 * Returns null when the id doesn't exist, or when `finishedOnly` is set and
 * the archive was taken mid-game.
 */
export function getArchive(id, { finishedOnly = false } = {}) {
  const row = getDb()
    .prepare('SELECT * FROM archived_games WHERE id = ?')
    .get(Number(id));
  if (!row) return null;
  if (finishedOnly && row.game_status !== 'finished') return null;

  let data;
  try {
    data = JSON.parse(row.data_json);
  } catch {
    logger.error('Corrupted archive payload', { archiveId: row.id });
    return null;
  }

  return {
    id: row.id,
    label: row.label,
    winner: row.winner,
    gameStatus: row.game_status,
    archivedAt: row.archived_at,
    ...buildArchiveView(data),
  };
}

export function deleteArchive(id) {
  const result = getDb().prepare('DELETE FROM archived_games WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

/**
 * Turn a raw snapshot into the shape the history views consume:
 * players, final scoreboard, and per-phase vote details mirroring
 * GET /api/admin/phase/votes.
 */
function buildArchiveView(data) {
  const players = data.tables?.players || [];
  const phases = data.tables?.phases || [];
  const votes = data.tables?.votes || [];
  const identifications = data.tables?.ghost_identifications || [];
  const victims = data.tables?.phase_victims || [];

  const byId = new Map(players.map(p => [p.id, p]));
  const nameOf = (id) => byId.get(id)?.name || '?';
  const roleOf = (id) => byId.get(id)?.role || null;

  const phaseViews = phases.map(phase => {
    const phaseVotes = votes.filter(v => v.phase_id === phase.id);

    const tally = (voteType) => {
      const counts = new Map();
      for (const vote of phaseVotes) {
        if (vote.vote_type !== voteType) continue;
        if (!vote.is_valid || vote.target_id == null) continue;
        counts.set(vote.target_id, (counts.get(vote.target_id) || 0) + 1);
      }
      return [...counts.entries()]
        .map(([targetId, count]) => ({ targetId, targetName: nameOf(targetId), count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      id: phase.id,
      type: phase.type,
      status: phase.status,
      timestampStart: phase.timestamp_start,
      timestampEnd: phase.timestamp_end,
      wolfResults: tally('wolf'),
      villagerGuessResults: tally('villager_guess'),
      ghostResults: tally('ghost_eliminate'),
      villageResults: tally('village'),
      details: phaseVotes.map(vote => ({
        id: vote.id,
        vote_type: vote.vote_type,
        is_valid: vote.is_valid,
        voter_id: vote.voter_id,
        voter_name: nameOf(vote.voter_id),
        voter_role: roleOf(vote.voter_id),
        target_id: vote.target_id,
        target_name: vote.target_id == null ? null : nameOf(vote.target_id),
        target_role: vote.target_id == null ? null : roleOf(vote.target_id),
      })),
      ghostIdentifications: identifications
        .filter(gi => gi.phase_id === phase.id)
        .map(gi => ({
          ghost_id: gi.ghost_id,
          ghost_name: nameOf(gi.ghost_id),
          target_id: gi.target_id,
          target_name: nameOf(gi.target_id),
          target_role: roleOf(gi.target_id),
          target_is_wolf: gi.target_is_wolf,
        })),
      victims: victims
        .filter(v => v.phase_id === phase.id)
        .map(v => ({
          playerId: v.player_id,
          playerName: nameOf(v.player_id),
          role: roleOf(v.player_id),
          eliminatedBy: v.eliminated_by,
          wasResurrected: v.was_resurrected,
        })),
    };
  }).sort((a, b) => b.id - a.id);

  const scoreboard = [...players]
    .map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      special_role: p.special_role,
      status: p.status,
      score: p.score ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { phases: phaseViews, scoreboard };
}
