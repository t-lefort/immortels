import { getSetting } from '../db.js';

/**
 * Admin authentication middleware.
 * Checks `x-admin-password` header or `admin_password` cookie
 * against the value stored in game_settings.
 */
export function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'] || req.cookies?.admin_password;
  const expected = getSetting('admin_password');

  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Mot de passe admin invalide' });
  }

  next();
}
