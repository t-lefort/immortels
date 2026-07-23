import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password hashing for player accounts.
 *
 * Uses Node's built-in scrypt so the project keeps its zero-extra-dependency
 * footprint. Stored format: `scrypt$<saltHex>$<hashHex>`.
 */

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Hash a plaintext password. Returns the storable string.
 */
export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Returns false for any malformed or missing hash rather than throwing.
 */
export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, saltHex, hashHex] = parts;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(password, salt, expected.length);
  return timingSafeEqual(derived, expected);
}

/**
 * Normalize a username for storage and lookup: trimmed, lowercased.
 * Usernames are compared case-insensitively so "Thomas" and "thomas"
 * can't be two different accounts.
 */
export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

/**
 * Validate a username. Returns an error message (French) or null if valid.
 */
export function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'Le pseudo est requis.';
  if (normalized.length < 3) return 'Le pseudo doit faire au moins 3 caractères.';
  if (normalized.length > 30) return 'Le pseudo ne peut pas dépasser 30 caractères.';
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    return 'Le pseudo ne peut contenir que des lettres, chiffres, points, tirets et underscores.';
  }
  return null;
}

/**
 * Validate a password. Returns an error message (French) or null if valid.
 */
export function validatePassword(password) {
  if (typeof password !== 'string' || !password) return 'Le mot de passe est requis.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

/**
 * Clean a first/last name. Returns the trimmed value or null.
 */
export function cleanNamePart(value) {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

/**
 * Build the display name shown everywhere in the game from first + last name.
 * Falls back gracefully when only one part is provided.
 */
export function buildDisplayName(firstName, lastName) {
  return [cleanNamePart(firstName), cleanNamePart(lastName)].filter(Boolean).join(' ');
}
