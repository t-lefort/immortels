/**
 * Helper functions for managing comma-separated special_role values.
 *
 * The `special_role` column in the players table stores multiple roles
 * as comma-separated values, e.g. "chasseur,maire" or "protecteur".
 * These helpers provide safe parsing, checking, adding, and removing.
 */

/**
 * Parse a special_role string into an array of roles.
 * Returns empty array for null/undefined/empty.
 */
export function parseSpecialRoles(specialRoleStr) {
  if (!specialRoleStr) return [];
  return specialRoleStr.split(',').map(r => r.trim()).filter(Boolean);
}

/**
 * Check if a player's special_role string contains a specific role.
 */
export function hasSpecialRole(specialRoleStr, role) {
  return parseSpecialRoles(specialRoleStr).includes(role);
}

/**
 * Add a role to a special_role string. Returns the new string.
 * Does not add duplicates.
 */
export function addSpecialRole(specialRoleStr, role) {
  const roles = parseSpecialRoles(specialRoleStr);
  if (roles.includes(role)) return roles.join(',');
  roles.push(role);
  return roles.join(',');
}

/**
 * Remove a role from a special_role string. Returns the new string,
 * or null if no roles remain.
 */
export function removeSpecialRole(specialRoleStr, role) {
  const roles = parseSpecialRoles(specialRoleStr).filter(r => r !== role);
  return roles.length > 0 ? roles.join(',') : null;
}

/**
 * Convert an array of roles back to a DB string.
 * Returns null for empty arrays.
 */
export function rolesToString(rolesArray) {
  if (!rolesArray || rolesArray.length === 0) return null;
  return rolesArray.join(',');
}

/**
 * Build a SQL LIKE condition for checking if special_role contains a given role.
 * Returns an object with { clause, params } where clause is something like:
 *   "(special_role = ? OR special_role LIKE ? OR special_role LIKE ? OR special_role LIKE ?)"
 * This matches: exact value, starts with "role,", ends with ",role", or contains ",role,"
 */
export function sqlHasRole(role) {
  return {
    clause: "(special_role = ? OR special_role LIKE ? OR special_role LIKE ? OR special_role LIKE ?)",
    params: [role, `${role},%`, `%,${role}`, `%,${role},%`],
  };
}
