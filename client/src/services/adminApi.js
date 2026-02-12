const BASE = '/api/admin';

function getHeaders() {
  const password = localStorage.getItem('admin_password');
  return {
    'Content-Type': 'application/json',
    ...(password ? { 'x-admin-password': password } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

export function getPlayers() {
  return request('/players');
}

export function bulkAddPlayers(names) {
  return request('/players/bulk', {
    method: 'POST',
    body: JSON.stringify({ names }),
  });
}

export function deletePlayer(id) {
  return request(`/players/${id}`, { method: 'DELETE' });
}

export function assignRoles(numWolves) {
  return request('/game/assign-roles', {
    method: 'POST',
    body: JSON.stringify({ numWolves }),
  });
}

export function startGame() {
  return request('/game/start', { method: 'POST' });
}

// ─── Phases ─────────────────────────────────────────────────────────────────

export function createPhase(type) {
  return request('/phase/create', {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export function startPhase(phaseId) {
  return request('/phase/start', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function openVoting(phaseId) {
  return request('/phase/open-voting', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function closeVoting(phaseId) {
  return request('/phase/close-voting', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function getPhaseResults(phaseId) {
  return request(`/phase/results?phaseId=${phaseId}`);
}

export function revealPhase(phaseId, victims = []) {
  return request('/phase/reveal', {
    method: 'POST',
    body: JSON.stringify({ phaseId, victims }),
  });
}

export function skipPhase(phaseId) {
  return request('/phase/skip', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function getPhaseVotes(phaseId) {
  return request(`/phase/votes?phaseId=${phaseId}`);
}

export function generateSpeechOrder() {
  return request('/phase/speech-order', { method: 'POST' });
}

export function startTimer(duration) {
  return request('/timer/start', {
    method: 'POST',
    body: JSON.stringify({ duration }),
  });
}

export function getPhases() {
  return request('/phases');
}

// ─── Special Powers ─────────────────────────────────────────────────────────

export function triggerSpecialPower(playerId, power) {
  return request('/special/trigger', {
    method: 'POST',
    body: JSON.stringify({ playerId, power }),
  });
}

export function forceSpecialPower(params) {
  return request('/special/force', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getSpecialRolesStatus() {
  return request('/special/status');
}

export function skipSpecialPower(power) {
  return request('/special/skip', {
    method: 'POST',
    body: JSON.stringify({ power }),
  });
}

// ─── Challenges ─────────────────────────────────────────────────────────────

export function createChallenge(data) {
  return request('/challenge', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function assignChallenge(challengeId, playerId) {
  return request('/challenge/assign', {
    method: 'POST',
    body: JSON.stringify({ challengeId, playerId }),
  });
}

export function getChallenges() {
  return request('/challenges');
}

// ─── Overrides ──────────────────────────────────────────────────────────────

export function updatePlayer(id, data) {
  return request(`/player/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function undoPhase(phaseId) {
  return request('/phase/undo', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function resetGame() {
  return request('/game/reset', { method: 'POST' });
}

export function forceVote(phaseId, voterId, targetId, voteType) {
  return request('/force-vote', {
    method: 'POST',
    body: JSON.stringify({ phaseId, voterId, targetId, voteType }),
  });
}

export function wolfTieBreak(phaseId, targetId) {
  return request('/wolf-tie-break', {
    method: 'POST',
    body: JSON.stringify({ phaseId, targetId }),
  });
}

// ─── Scores ─────────────────────────────────────────────────────────────────

export function getScoreboard() {
  return request('/scoreboard');
}

export function endGame() {
  return request('/game/end', { method: 'POST' });
}

// ─── Auth check ─────────────────────────────────────────────────────────────

export async function checkAuth() {
  try {
    await request('/players');
    return true;
  } catch {
    return false;
  }
}
