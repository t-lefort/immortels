import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'game.db');

let db = null;

/**
 * Returns the singleton database instance, creating it if needed.
 */
export function getDb() {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Pragmas: WAL mode for better concurrent reads, foreign keys enforced
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema();
  runMigrations();
  initDefaultSettings();

  return db;
}

/**
 * Create all tables if they don't exist.
 */
function initSchema() {
  db.exec(`
    -- Key/value store for all game state
    CREATE TABLE IF NOT EXISTS game_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Players
    -- "name" is the DISPLAY name (built from first_name + last_name once an
    -- account exists). "username" is the login pseudo — never displayed.
    CREATE TABLE IF NOT EXISTS players (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL UNIQUE,
      username           TEXT    DEFAULT NULL,           -- login pseudo (unique, never shown)
      password_hash      TEXT    DEFAULT NULL,           -- scrypt hash, NULL = account not claimed yet
      first_name         TEXT    DEFAULT NULL,
      last_name          TEXT    DEFAULT NULL,
      role               TEXT    DEFAULT NULL,           -- 'wolf' | 'villager' | NULL (before assignment)
      special_role       TEXT    DEFAULT NULL,           -- 'maire' | 'sorciere' | 'protecteur' | 'voyante' | 'chasseur' | 'immunite'
      status             TEXT    NOT NULL DEFAULT 'alive', -- 'alive' | 'ghost'
      eliminated_at_phase INTEGER DEFAULT NULL,
      eliminated_by      TEXT    DEFAULT NULL,           -- 'wolves' | 'ghosts' | 'village' | 'chasseur'
      session_token      TEXT    UNIQUE,
      score              INTEGER NOT NULL DEFAULT 0,
      role_seen          INTEGER NOT NULL DEFAULT 0      -- 1 = player has seen their role reveal
    );

    -- Game phases
    CREATE TABLE IF NOT EXISTS phases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type            TEXT    NOT NULL,                  -- 'night' | 'village_council'
      status          TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'voting' | 'completed'
      timestamp_start DATETIME DEFAULT NULL,
      timestamp_end   DATETIME DEFAULT NULL
    );

    -- Victims of each phase (supports multiple per phase)
    CREATE TABLE IF NOT EXISTS phase_victims (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id        INTEGER NOT NULL REFERENCES phases(id),
      player_id       INTEGER NOT NULL REFERENCES players(id),
      eliminated_by   TEXT    NOT NULL,                  -- 'wolves' | 'ghosts' | 'village' | 'chasseur'
      was_protected   INTEGER NOT NULL DEFAULT 0,
      was_resurrected INTEGER NOT NULL DEFAULT 0
    );

    -- Votes (only real votes stored)
    CREATE TABLE IF NOT EXISTS votes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id  INTEGER NOT NULL REFERENCES phases(id),
      voter_id  INTEGER NOT NULL REFERENCES players(id),
      target_id INTEGER          REFERENCES players(id), -- NULL if abstention
      vote_type TEXT    NOT NULL,                         -- 'wolf' | 'ghost_eliminate' | 'village' | 'villager_guess'
      is_valid  INTEGER NOT NULL DEFAULT 1
    );

    -- Ghost identifications (villager ghosts identifying wolves)
    CREATE TABLE IF NOT EXISTS ghost_identifications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id       INTEGER NOT NULL REFERENCES phases(id),
      ghost_id       INTEGER NOT NULL REFERENCES players(id),
      target_id      INTEGER NOT NULL REFERENCES players(id),
      target_is_wolf INTEGER NOT NULL DEFAULT 0           -- computed at vote close
    );

    -- Challenges / épreuves
    CREATE TABLE IF NOT EXISTS challenges (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      name                     TEXT    NOT NULL,
      after_phase_id           INTEGER          REFERENCES phases(id),
      winning_team_player_ids  TEXT    NOT NULL DEFAULT '[]', -- JSON array of player IDs
      special_role_awarded     TEXT    NOT NULL,              -- 'maire' | 'sorciere' | etc.
      awarded_to_player_id     INTEGER          REFERENCES players(id),
      timestamp                DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    -- Score snapshots (before each score mutation)
    CREATE TABLE IF NOT EXISTS score_snapshots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
      reason       TEXT NOT NULL,
      context_json TEXT NOT NULL DEFAULT '{}',
      scores_json  TEXT NOT NULL
    );

    -- Individual score movements used by the admin audit trail
    CREATE TABLE IF NOT EXISTS score_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      phase_id      INTEGER REFERENCES phases(id),
      source_type   TEXT NOT NULL,
      source_id     TEXT,
      reason        TEXT NOT NULL,
      delta         INTEGER NOT NULL,
      score_before  INTEGER NOT NULL,
      score_after   INTEGER NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    -- Finished games kept across resets so players can review them later
    CREATE TABLE IF NOT EXISTS archived_games (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      label       TEXT NOT NULL,
      winner      TEXT,
      archived_at DATETIME NOT NULL DEFAULT (datetime('now')),
      data_json   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_score_events_phase ON score_events(phase_id, id);
    CREATE INDEX IF NOT EXISTS idx_score_events_player ON score_events(player_id, id);
  `);
}

/**
 * Run schema migrations for existing databases.
 */
function runMigrations() {
  const cols = db.prepare("PRAGMA table_info(players)").all();
  const hasColumn = (name) => cols.some(c => c.name === name);

  if (!hasColumn('role_seen')) {
    db.exec("ALTER TABLE players ADD COLUMN role_seen INTEGER NOT NULL DEFAULT 0");
  }

  // Account columns (added with the pseudo/password login)
  if (!hasColumn('username')) {
    db.exec('ALTER TABLE players ADD COLUMN username TEXT DEFAULT NULL');
  }
  if (!hasColumn('password_hash')) {
    db.exec('ALTER TABLE players ADD COLUMN password_hash TEXT DEFAULT NULL');
  }
  if (!hasColumn('first_name')) {
    db.exec('ALTER TABLE players ADD COLUMN first_name TEXT DEFAULT NULL');
  }
  if (!hasColumn('last_name')) {
    db.exec('ALTER TABLE players ADD COLUMN last_name TEXT DEFAULT NULL');
  }

  // Created here rather than in initSchema: on a pre-existing database the
  // `username` column only exists once the ALTER TABLE above has run.
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username ON players(username) WHERE username IS NOT NULL'
  );
}

/**
 * Insert default settings if they don't already exist.
 */
function initDefaultSettings() {
  const defaults = {
    game_status: 'setup',                // 'setup' | 'in_progress' | 'finished'
    admin_password: process.env.ADMIN_PASSWORD || 'changeme',
    current_phase_id: null,
    num_wolves: '8',
    moonless_night: '0',                 // '0' = seer active, '1' = disabled
    protected_player_id: null,
    last_protected_player_id: null,
    witch_used: '0',
    seer_uses_remaining: '2',
    mayor_id: null,
    hunter_pending: '0',
    hunter_player_id: null,
    protecteur_pending: '0',
    sorciere_pending: '0',
    sorciere_victim_id: null,
    voyante_pending: '0',
    mayor_succession_pending: '0',
  };

  const insert = db.prepare(
    'INSERT OR IGNORE INTO game_settings (key, value) VALUES (?, ?)'
  );

  const insertMany = db.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) {
      insert.run(key, value);
    }
  });

  insertMany();
}

// ─── Helper functions ────────────────────────────────────────────────────────

/**
 * Get a single setting value by key.
 */
export function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM game_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Set a single setting value. Creates the key if it doesn't exist.
 */
export function setSetting(key, value) {
  getDb()
    .prepare('INSERT INTO game_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

/**
 * Get all settings as a plain object.
 */
export function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM game_settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Tables holding the current game. `archived_games` is deliberately absent:
 * archives must survive a reset, that is their whole point.
 */
export const GAME_TABLES = [
  'score_events',
  'score_snapshots',
  'ghost_identifications',
  'phase_victims',
  'votes',
  'challenges',
  'phases',
  'players',
];

/**
 * Reset the entire game: truncate all game tables and re-insert default
 * settings. Archived games are preserved.
 */
export function resetGame() {
  const database = getDb();
  database.transaction(() => {
    for (const table of GAME_TABLES) {
      database.prepare(`DELETE FROM ${table}`).run();
    }
    database.prepare('DELETE FROM game_settings').run();
    // Keep the archived_games counter intact so archive IDs stay stable
    database.prepare("DELETE FROM sqlite_sequence WHERE name != 'archived_games'").run();
  })();
  initDefaultSettings();
}

/**
 * Close the database connection gracefully.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
