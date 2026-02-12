/**
 * Session override for multi-tab testing.
 *
 * When the URL contains ?as=PlayerName, this module resolves the player's
 * session token from the server and stores it in memory.  All HTTP requests
 * (via playerApi.js) and socket connections then use this token instead of
 * the cookie-based session.
 *
 * Each browser tab has its own JS context, so different tabs can use
 * different override tokens simultaneously.
 */

let _overrideToken = null;
let _resolvePromise = null;
let _initDone = false;

/**
 * Returns the player name from the ?as= query parameter, or null.
 */
export function getOverrideName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('as') || null;
}

/**
 * Initialize the override: if ?as=X is present, fetch the token from the server.
 * Returns a promise that resolves when ready (with or without override).
 * Safe to call multiple times -- only runs once.
 */
export async function initSessionOverride() {
  if (_initDone) return _overrideToken;

  // If already initializing, wait for the same promise
  if (_resolvePromise) return _resolvePromise;

  const name = getOverrideName();
  if (!name) {
    _initDone = true;
    return null;
  }

  _resolvePromise = (async () => {
    try {
      const res = await fetch(`/api/player/token-by-name?name=${encodeURIComponent(name)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn(`[sessionOverride] Could not resolve token for "${name}":`, data.error || res.status);
        _initDone = true;
        return null;
      }
      const data = await res.json();
      _overrideToken = data.token;
      console.log(`[sessionOverride] Acting as "${data.name}" (id=${data.playerId})`);
      _initDone = true;
      return _overrideToken;
    } catch (err) {
      console.warn('[sessionOverride] Failed to resolve token:', err);
      _initDone = true;
      return null;
    }
  })();

  return _resolvePromise;
}

/**
 * Returns the override token if one was resolved, or null.
 * Must call initSessionOverride() first.
 */
export function getOverrideToken() {
  return _overrideToken;
}

/**
 * Returns true if session override is active (a ?as= param was provided
 * and the token was successfully resolved).
 */
export function hasSessionOverride() {
  return _overrideToken !== null;
}
