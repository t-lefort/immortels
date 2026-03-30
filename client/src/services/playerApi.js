import { getOverrideToken } from './sessionOverride.js';

const PLAYER_BASE = '/api/player';
const GAME_BASE = '/api/game';

async function request(url, options = {}) {
  // If a session override is active (?as=PlayerName), send the token
  // as a header so the server uses it instead of the cookie.
  const overrideToken = getOverrideToken();
  const extraHeaders = overrideToken ? { 'X-Session-Token': overrideToken } : {};

  const res = await fetch(url, {
    ...options,
    credentials: 'include', // send session cookie (fallback when no override)
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Auth / Session ──────────────────────────────────────────────────────────

export function joinGame(name) {
  return request(`${PLAYER_BASE}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getMe() {
  return request(`${PLAYER_BASE}/me`);
}

export function markRoleSeen() {
  return request(`${PLAYER_BASE}/role-seen`, { method: 'POST' });
}

// ─── Game State ──────────────────────────────────────────────────────────────

export function getGameState() {
  return request(`${GAME_BASE}/state`);
}

export function getPhase(phaseId) {
  return request(`${GAME_BASE}/phase/${phaseId}`);
}

export function getScoreboard() {
  return request(`${GAME_BASE}/scoreboard`);
}

// ─── Voting ──────────────────────────────────────────────────────────────────

export function submitVote(targetId) {
  return request(`${PLAYER_BASE}/vote`, {
    method: 'POST',
    body: JSON.stringify({ targetId }),
  });
}

export function submitVillagerGuess(targetId) {
  return request(`${PLAYER_BASE}/villager-guess`, {
    method: 'POST',
    body: JSON.stringify({ targetId }),
  });
}

export function submitGhostIdentification(targetIds) {
  return request(`${PLAYER_BASE}/ghost-identify`, {
    method: 'POST',
    body: JSON.stringify({ targetIds }),
  });
}

// ─── Special Powers ─────────────────────────────────────────────────────────

export function submitSpecialResponse(type, response) {
  return request(`${PLAYER_BASE}/special-respond`, {
    method: 'POST',
    body: JSON.stringify({ type, response }),
  });
}

// ─── Wolf Info ───────────────────────────────────────────────────────────────

export function getWolves() {
  return request(`${PLAYER_BASE}/wolves`);
}
