const PLAYER_BASE = '/api/player';
const GAME_BASE = '/api/game';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include', // send session cookie
    headers: {
      'Content-Type': 'application/json',
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

// ─── Game State ──────────────────────────────────────────────────────────────

export function getGameState() {
  return request(`${GAME_BASE}/state`);
}

export function getPhase(phaseId) {
  return request(`${GAME_BASE}/phase/${phaseId}`);
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

// ─── Wolf Info ───────────────────────────────────────────────────────────────

export function getWolves() {
  return request(`${PLAYER_BASE}/wolves`);
}
