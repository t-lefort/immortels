export const MAX_GHOST_IDENTIFICATIONS = 2;
export const GHOST_CORRECT_IDENTIFICATION_POINTS = 2;
export const GHOST_WRONG_IDENTIFICATION_POINTS = -1;

export const WINNING_FACTION_POINTS = 2;
export const WINNING_FACTION_SURVIVOR_BONUS = 1;

/**
 * Validate and normalize the targets selected by a villager ghost.
 * A ghost may identify one or two distinct living players per night.
 */
export function validateGhostIdentificationTargets(targetIds) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    throw new Error('Vous devez identifier au moins un joueur.');
  }

  if (targetIds.length > MAX_GHOST_IDENTIFICATIONS) {
    throw new Error(`Vous ne pouvez identifier que ${MAX_GHOST_IDENTIFICATIONS} joueurs maximum par nuit.`);
  }

  const normalized = targetIds.map(Number);
  if (normalized.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Une ou plusieurs cibles sont invalides.');
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Vous ne pouvez pas identifier deux fois le même joueur.');
  }

  return normalized;
}

export function getGhostIdentificationDelta(targetIsWolf) {
  return targetIsWolf
    ? GHOST_CORRECT_IDENTIFICATION_POINTS
    : GHOST_WRONG_IDENTIFICATION_POINTS;
}

export function getWinningFactionDelta(status) {
  return WINNING_FACTION_POINTS
    + (status === 'alive' ? WINNING_FACTION_SURVIVOR_BONUS : 0);
}
