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

export function advanceSpeaker(direction = 'next') {
  return request('/phase/speech-advance', {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
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

export function triggerSpecialPower(params) {
  return request('/special/trigger', {
    method: 'POST',
    body: JSON.stringify(params),
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

export function setChallengeWinners(challengeId, winningPlayerIds) {
  return request(`/challenge/${challengeId}/winners`, {
    method: 'PUT',
    body: JSON.stringify({ winningPlayerIds }),
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

export function displayChallenge(name) {
  return request('/challenge/display', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function clearChallengeDisplay() {
  return request('/challenge/display-clear', { method: 'POST' });
}

export function dashboardForceHome() {
  return request('/dashboard/force-home', { method: 'POST' });
}

export function dismissVoteReveal() {
  return request('/vote-reveal/dismiss', { method: 'POST' });
}

export function showVoteReveal(phaseId) {
  return request('/vote-reveal/show', {
    method: 'POST',
    body: JSON.stringify({ phaseId }),
  });
}

export function getVoteReveal(phaseId) {
  return request(`/vote-reveal/${phaseId}`);
}

// ─── Export / Import / Archives ─────────────────────────────────────────────

/**
 * Downloads the full game as a JSON file. Bypasses `request` because the
 * response is a file attachment, not JSON to parse.
 */
export async function exportGame() {
  const res = await fetch(`${BASE}/game/export`, { headers: getHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'les-immortels-export.json';

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { filename };
}

export function importGame(snapshot) {
  return request('/game/import', {
    method: 'POST',
    body: JSON.stringify(snapshot),
  });
}

export function getArchives() {
  return request('/archives');
}

export function getArchive(id) {
  return request(`/archives/${id}`);
}

export function createArchive(label) {
  return request('/archives', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function deleteArchive(id) {
  return request(`/archives/${id}`, { method: 'DELETE' });
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

export function resetGame({ archive = true, archiveLabel } = {}) {
  return request('/game/reset', {
    method: 'POST',
    body: JSON.stringify({ archive, archiveLabel }),
  });
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

export function getScoreSnapshots(limit = 100) {
  return request(`/score-snapshots?limit=${limit}`);
}

export function getScoreEvents(limit = 300) {
  return request(`/score-events?limit=${limit}`);
}

export function endGame(winner) {
  return request('/game/end', {
    method: 'POST',
    body: JSON.stringify({ winner }),
  });
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
