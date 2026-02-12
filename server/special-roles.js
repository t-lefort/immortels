import { getDb, getSetting, setSetting } from './db.js';
import {
  eliminatePlayer,
  protectPlayer,
  resurrectPlayer,
  getCurrentPhase,
} from './game-engine.js';
import {
  emitToPlayer,
  emitToAdmin,
  emitToAll,
  updatePlayerRooms,
} from './socket-rooms.js';

// ─── Maire (Mayor) ──────────────────────────────────────────────────────────

/**
 * Apply mayor double vote weight in council resolution.
 * This is already handled in game-engine.js resolveVillageCouncil().
 * This helper returns the current mayor info for admin display.
 */
export function getMayorInfo() {
  const mayorIdStr = getSetting('mayor_id');
  if (!mayorIdStr) return null;

  const db = getDb();
  const mayor = db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(Number(mayorIdStr));
  return mayor || null;
}

/**
 * When mayor is eliminated, prompt them to choose a successor.
 * Sends special:prompt to the mayor and notifies admin.
 */
export function handleMayorSuccession(io, eliminatedPlayerId) {
  const db = getDb();
  const player = db.prepare('SELECT id, name FROM players WHERE id = ?').get(eliminatedPlayerId);
  if (!player) return { skipped: true, reason: 'player_not_found' };

  const alivePlayers = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive' AND id != ?"
  ).all(eliminatedPlayerId);

  setSetting('mayor_succession_pending', '1');

  emitToPlayer(io, player.id, 'special:prompt', {
    power: 'mayor_succession',
    playerId: player.id,
    playerName: player.name,
    targets: alivePlayers,
  });

  emitToAdmin(io, 'special:prompt', {
    power: 'mayor_succession',
    playerId: player.id,
    playerName: player.name,
    targets: alivePlayers,
  });

  return { triggered: true, mayorId: player.id, targets: alivePlayers };
}

/**
 * Process the mayor's succession choice.
 * Validates that the new mayor is alive. If the chosen player is already dead,
 * rejects the choice so admin can pick again.
 */
export function processMayorSuccession(io, newMayorId) {
  const db = getDb();
  const newMayor = db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(Number(newMayorId));
  if (!newMayor) throw new Error(`Player ${newMayorId} not found`);

  // New mayor must be alive
  if (newMayor.status !== 'alive') {
    throw new Error(`${newMayor.name} est un fantôme et ne peut pas devenir maire. Choisissez un joueur vivant.`);
  }

  setSetting('mayor_id', String(newMayorId));
  setSetting('mayor_succession_pending', '0');

  // Notify admin of result
  emitToAdmin(io, 'special:result', {
    power: 'mayor_succession',
    newMayorId: Number(newMayorId),
    newMayorName: newMayor.name,
  });

  // Notify the new mayor
  emitToPlayer(io, Number(newMayorId), 'special:result', {
    power: 'mayor_succession',
    newMayorId: Number(newMayorId),
    newMayorName: newMayor.name,
  });

  return { newMayorId: Number(newMayorId), newMayorName: newMayor.name };
}

/**
 * Admin forces a mayor succession.
 * Used when the eliminated mayor is unresponsive.
 * Falls through to processMayorSuccession which validates the new mayor is alive.
 */
export function forceMayorSuccession(io, newMayorId) {
  return processMayorSuccession(io, newMayorId);
}

// ─── Sorciere (Witch) ───────────────────────────────────────────────────────

/**
 * Prompt the witch: "Do you want to resurrect [victim]?"
 * Called during night resolution after wolf vote is known.
 */
export function handleSorciere(io, phaseId, victimId) {
  const db = getDb();

  // Check if witch power already used
  const witchUsed = getSetting('witch_used');
  if (witchUsed === '1') {
    return { skipped: true, reason: 'already_used' };
  }

  // Find the witch player
  const witch = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'sorciere' AND status = 'alive'"
  ).get();

  if (!witch) {
    return { skipped: true, reason: 'no_witch' };
  }

  // Get victim info
  const victim = db.prepare('SELECT id, name FROM players WHERE id = ?').get(Number(victimId));
  if (!victim) {
    return { skipped: true, reason: 'no_victim' };
  }

  setSetting('sorciere_pending', '1');
  setSetting('sorciere_victim_id', String(victimId));

  emitToPlayer(io, witch.id, 'special:prompt', {
    power: 'sorciere',
    playerId: witch.id,
    playerName: witch.name,
    victimId: victim.id,
    victimName: victim.name,
  });

  emitToAdmin(io, 'special:prompt', {
    power: 'sorciere',
    playerId: witch.id,
    playerName: witch.name,
    victimId: victim.id,
    victimName: victim.name,
    status: 'waiting',
  });

  return { triggered: true, witchId: witch.id, victimId: victim.id };
}

/**
 * Process the witch's response.
 */
export function processSorciereResponse(io, resurrect, victimId) {
  const db = getDb();

  setSetting('sorciere_pending', '0');

  if (resurrect) {
    const victim = resurrectPlayer(Number(victimId));

    // Update room membership: player is alive again
    updatePlayerRooms(io, Number(victimId), 'alive');

    // Get witch player for notification
    const witch = db.prepare(
      "SELECT id FROM players WHERE special_role = 'sorciere'"
    ).get();

    if (witch) {
      emitToPlayer(io, witch.id, 'special:result', {
        power: 'sorciere',
        action: 'resurrect',
        target: { id: victim.id, name: victim.name },
      });
    }

    emitToAdmin(io, 'special:result', {
      power: 'sorciere',
      action: 'resurrect',
      target: { id: victim.id, name: victim.name },
    });

    return { action: 'resurrect', victim };
  } else {
    // Witch chose not to resurrect — mark power as used anyway? No.
    // Per spec: witch_used only set when actually using the power (resurrect).
    // If witch declines, power remains available. Let's re-read the spec:
    // "Single use (check game_settings.witch_used)" — means one use total.
    // The witch can decline and keep her power for later.

    const witch = db.prepare(
      "SELECT id FROM players WHERE special_role = 'sorciere'"
    ).get();

    if (witch) {
      emitToPlayer(io, witch.id, 'special:result', {
        power: 'sorciere',
        action: 'skip',
      });
    }

    emitToAdmin(io, 'special:result', {
      power: 'sorciere',
      action: 'skip',
    });

    return { action: 'skip' };
  }
}

// ─── Protecteur (Protector) ─────────────────────────────────────────────────

/**
 * Prompt the protector to choose who to protect this night.
 */
export function handleProtecteur(io, phaseId) {
  const db = getDb();

  // Find the protector
  const protector = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'protecteur' AND status = 'alive'"
  ).get();

  if (!protector) {
    return { skipped: true, reason: 'no_protector' };
  }

  // Get alive players (excluding self and last protected)
  const lastProtectedIdStr = getSetting('last_protected_player_id');
  const lastProtectedId = lastProtectedIdStr ? Number(lastProtectedIdStr) : null;

  const alivePlayers = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive' AND id != ?"
  ).all(protector.id);

  // Filter out last protected player (cannot protect same player two nights in a row)
  const targets = alivePlayers.filter(p => p.id !== lastProtectedId);

  setSetting('protecteur_pending', '1');

  emitToPlayer(io, protector.id, 'special:prompt', {
    power: 'protecteur',
    playerId: protector.id,
    playerName: protector.name,
    targets,
    lastProtectedId,
  });

  emitToAdmin(io, 'special:prompt', {
    power: 'protecteur',
    playerId: protector.id,
    playerName: protector.name,
    targets,
    lastProtectedId,
    status: 'waiting',
  });

  return { triggered: true, protectorId: protector.id, targets };
}

/**
 * Process the protector's response.
 */
export function processProtecteurResponse(io, targetId) {
  const db = getDb();

  // Validate target
  const protector = db.prepare(
    "SELECT id FROM players WHERE special_role = 'protecteur'"
  ).get();

  if (protector && Number(targetId) === protector.id) {
    throw new Error('Le protecteur ne peut pas se protéger lui-même');
  }

  const lastProtectedIdStr = getSetting('last_protected_player_id');
  const lastProtectedId = lastProtectedIdStr ? Number(lastProtectedIdStr) : null;

  if (lastProtectedId && Number(targetId) === lastProtectedId) {
    throw new Error('Impossible de protéger le même joueur deux nuits de suite');
  }

  protectPlayer(Number(targetId));
  setSetting('protecteur_pending', '0');

  const target = db.prepare('SELECT id, name FROM players WHERE id = ?').get(Number(targetId));

  if (protector) {
    emitToPlayer(io, protector.id, 'special:result', {
      power: 'protecteur',
      targetId: Number(targetId),
      targetName: target?.name,
    });
  }

  emitToAdmin(io, 'special:result', {
    power: 'protecteur',
    targetId: Number(targetId),
    targetName: target?.name,
  });

  return { targetId: Number(targetId), targetName: target?.name };
}

// ─── Voyante (Seer) ─────────────────────────────────────────────────────────

/**
 * Prompt the seer to choose a player to reveal their role.
 */
export function handleVoyante(io, phaseId) {
  const db = getDb();

  // Check moonless night
  const moonless = getSetting('moonless_night');
  if (moonless === '1') {
    return { skipped: true, reason: 'moonless_night' };
  }

  // Check remaining uses
  const remaining = Number(getSetting('seer_uses_remaining') || '0');
  if (remaining <= 0) {
    return { skipped: true, reason: 'no_uses_remaining' };
  }

  // Find the seer
  const seer = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'voyante' AND status = 'alive'"
  ).get();

  if (!seer) {
    return { skipped: true, reason: 'no_seer' };
  }

  // Get alive players (excluding self)
  const targets = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive' AND id != ?"
  ).all(seer.id);

  setSetting('voyante_pending', '1');

  emitToPlayer(io, seer.id, 'special:prompt', {
    power: 'voyante',
    playerId: seer.id,
    playerName: seer.name,
    targets,
    usesRemaining: remaining,
  });

  emitToAdmin(io, 'special:prompt', {
    power: 'voyante',
    playerId: seer.id,
    playerName: seer.name,
    targets,
    usesRemaining: remaining,
    status: 'waiting',
  });

  return { triggered: true, seerId: seer.id, targets, usesRemaining: remaining };
}

/**
 * Process the seer's response — reveal a target's role.
 */
export function processVoyanteResponse(io, targetId) {
  const db = getDb();

  const target = db.prepare('SELECT id, name, role FROM players WHERE id = ?').get(Number(targetId));
  if (!target) throw new Error(`Player ${targetId} not found`);

  const remaining = Number(getSetting('seer_uses_remaining') || '0');
  if (remaining > 0) {
    setSetting('seer_uses_remaining', String(remaining - 1));
  }
  setSetting('voyante_pending', '0');

  const seer = db.prepare(
    "SELECT id FROM players WHERE special_role = 'voyante'"
  ).get();

  const result = {
    power: 'voyante',
    target: {
      id: target.id,
      name: target.name,
      role: target.role,
    },
    usesRemaining: Math.max(0, remaining - 1),
  };

  if (seer) {
    emitToPlayer(io, seer.id, 'special:result', result);
  }

  emitToAdmin(io, 'special:result', result);

  return result;
}

// ─── Chasseur (Hunter) ──────────────────────────────────────────────────────

/**
 * When hunter is eliminated, prompt them to choose a target to kill.
 */
export function handleChasseur(io, hunterId) {
  const db = getDb();

  const hunter = db.prepare('SELECT id, name FROM players WHERE id = ?').get(Number(hunterId));
  if (!hunter) return { skipped: true, reason: 'hunter_not_found' };

  const alivePlayers = db.prepare(
    "SELECT id, name FROM players WHERE status = 'alive'"
  ).all();

  setSetting('hunter_pending', '1');
  setSetting('hunter_player_id', String(hunterId));

  emitToPlayer(io, hunter.id, 'special:prompt', {
    power: 'chasseur',
    playerId: hunter.id,
    playerName: hunter.name,
    targets: alivePlayers,
  });

  emitToAdmin(io, 'special:prompt', {
    power: 'chasseur',
    playerId: hunter.id,
    playerName: hunter.name,
    targets: alivePlayers,
    status: 'waiting',
  });

  return { triggered: true, hunterId: hunter.id, targets: alivePlayers };
}

// Track hunter chain depth to prevent infinite recursion
let hunterChainDepth = 0;
const MAX_HUNTER_CHAIN_DEPTH = 5;

/**
 * Process the hunter's choice — eliminate target and compute scoring.
 * Chain reaction: if target is also a hunter, trigger their power too.
 * Recursion protection: max 5 chained hunter kills.
 */
export function processChasseurResponse(io, targetId, phaseId) {
  const db = getDb();

  const target = db.prepare('SELECT id, name, role, special_role, status FROM players WHERE id = ?').get(Number(targetId));
  if (!target) throw new Error(`Player ${targetId} not found`);

  // Check if target is already a ghost (can't kill twice)
  if (target.status === 'ghost') {
    throw new Error(`Le joueur ${target.name} est déjà un fantôme`);
  }

  // Save the hunter player ID BEFORE clearing it
  const hunterPlayerIdStr = getSetting('hunter_player_id');
  const hunterId = hunterPlayerIdStr ? Number(hunterPlayerIdStr) : null;

  // Determine phase for the elimination record
  const effectivePhaseId = phaseId || (getCurrentPhase()?.id) || null;

  // Eliminate the target
  const victim = eliminatePlayer(Number(targetId), effectivePhaseId, 'chasseur');

  setSetting('hunter_pending', '0');
  setSetting('hunter_player_id', null);

  // Update room membership: victim becomes ghost
  updatePlayerRooms(io, Number(targetId), 'ghost');

  // Compute hunter scoring: +2 if wolf, -1 if villager
  let scoreDelta = 0;
  let scoreReason = '';
  if (target.role === 'wolf') {
    scoreDelta = 2;
    scoreReason = 'hunter_killed_wolf';
  } else if (target.role === 'villager') {
    scoreDelta = -1;
    scoreReason = 'hunter_killed_villager';
  }

  if (scoreDelta !== 0 && hunterId) {
    db.prepare('UPDATE players SET score = score + ? WHERE id = ?').run(scoreDelta, hunterId);
  }

  // Broadcast elimination
  emitToAll(io, 'player:eliminated', {
    player: { id: victim.id, name: victim.name, role: victim.role },
    eliminatedBy: 'chasseur',
  });

  emitToPlayer(io, victim.id, 'player:eliminated', {
    playerId: victim.id,
  });

  // Send result to admin
  emitToAdmin(io, 'special:result', {
    power: 'chasseur',
    victim: { id: victim.id, name: victim.name, role: victim.role },
    scoreDelta,
    scoreReason,
  });

  // Chain reaction: if the killed target is also a hunter, trigger their power
  // with recursion protection (max 5 chains)
  if (target.special_role === 'chasseur') {
    hunterChainDepth++;
    if (hunterChainDepth > MAX_HUNTER_CHAIN_DEPTH) {
      console.warn(`[HUNTER] Chain reaction depth limit reached (${MAX_HUNTER_CHAIN_DEPTH}). Stopping chain.`);
      hunterChainDepth = 0;
      emitToAdmin(io, 'special:result', {
        power: 'chasseur',
        action: 'chain_limit_reached',
        message: `Limite de chaîne chasseur atteinte (${MAX_HUNTER_CHAIN_DEPTH})`,
      });
    } else {
      // Small delay to allow UI to process
      setTimeout(() => {
        handleChasseur(io, target.id);
      }, 100);
    }
  } else {
    // Reset chain depth when a non-hunter is killed
    hunterChainDepth = 0;
  }

  // Check if killed target is the mayor — trigger succession
  const mayorIdStr = getSetting('mayor_id');
  if (mayorIdStr && Number(mayorIdStr) === Number(targetId)) {
    handleMayorSuccession(io, Number(targetId));
  }

  return { victim, scoreDelta, scoreReason };
}

// ─── Immunite (Immunity) ────────────────────────────────────────────────────

/**
 * Handle immunity during village council.
 * If the player voted for elimination has immunity, they survive and lose the special role.
 * Returns true if immunity was applied, false otherwise.
 */
export function handleImmunite(phaseId, playerId) {
  const db = getDb();

  const player = db.prepare('SELECT id, name, special_role FROM players WHERE id = ?').get(Number(playerId));
  if (!player || player.special_role !== 'immunite') {
    return { applied: false };
  }

  // Remove immunity after use
  db.prepare("UPDATE players SET special_role = NULL WHERE id = ?").run(Number(playerId));

  return { applied: true, playerName: player.name };
}

// ─── Night Power Sequence Helper ────────────────────────────────────────────

/**
 * Get the status of all special role powers for admin display.
 * Returns which powers are available, pending, or completed for the current context.
 */
export function getSpecialRolesStatus() {
  const db = getDb();

  const protector = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'protecteur' AND status = 'alive'"
  ).get();

  const witch = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'sorciere' AND status = 'alive'"
  ).get();

  const seer = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'voyante' AND status = 'alive'"
  ).get();

  const hunter = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'chasseur'"
  ).get();

  const mayorIdStr = getSetting('mayor_id');
  const mayor = mayorIdStr
    ? db.prepare('SELECT id, name, status FROM players WHERE id = ?').get(Number(mayorIdStr))
    : null;

  const immunePlayers = db.prepare(
    "SELECT id, name FROM players WHERE special_role = 'immunite' AND status = 'alive'"
  ).all();

  return {
    protecteur: {
      available: !!protector,
      player: protector || null,
      pending: getSetting('protecteur_pending') === '1',
      lastProtectedId: getSetting('last_protected_player_id')
        ? Number(getSetting('last_protected_player_id'))
        : null,
    },
    sorciere: {
      available: !!witch && getSetting('witch_used') !== '1',
      player: witch || null,
      pending: getSetting('sorciere_pending') === '1',
      used: getSetting('witch_used') === '1',
    },
    voyante: {
      available: !!seer && Number(getSetting('seer_uses_remaining') || '0') > 0 && getSetting('moonless_night') !== '1',
      player: seer || null,
      pending: getSetting('voyante_pending') === '1',
      usesRemaining: Number(getSetting('seer_uses_remaining') || '0'),
      moonlessNight: getSetting('moonless_night') === '1',
    },
    chasseur: {
      player: hunter || null,
      pending: getSetting('hunter_pending') === '1',
    },
    maire: {
      player: mayor || null,
      successionPending: getSetting('mayor_succession_pending') === '1',
    },
    immunite: {
      players: immunePlayers,
    },
  };
}
