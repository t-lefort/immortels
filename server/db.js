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
    CREATE TABLE IF NOT EXISTS players (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL UNIQUE,
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
  `);
}

/**
 * Run schema migrations for existing databases.
 */
function runMigrations() {
  // Add role_seen column if it doesn't exist (for existing DBs)
  const cols = db.prepare("PRAGMA table_info(players)").all();
  if (!cols.some(c => c.name === 'role_seen')) {
    db.exec("ALTER TABLE players ADD COLUMN role_seen INTEGER NOT NULL DEFAULT 0");
  }
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
 * Reset the entire game: truncate all tables and re-insert default settings.
 */
export function resetGame() {
  const database = getDb();
  database.exec(`
    DELETE FROM score_snapshots;
    DELETE FROM ghost_identifications;
    DELETE FROM phase_victims;
    DELETE FROM votes;
    DELETE FROM challenges;
    DELETE FROM phases;
    DELETE FROM players;
    DELETE FROM game_settings;
    DELETE FROM sqlite_sequence;
  `);
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
