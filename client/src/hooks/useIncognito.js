import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'admin_incognito';

/**
 * Incognito mode for the admin screens that display roles.
 *
 * ON by default: the admin phone or laptop is often visible to players
 * standing nearby, and a glance at the Joueurs or Scores tab would otherwise
 * hand them the whole cast. The preference is remembered per browser, but a
 * fresh browser always starts hidden.
 *
 * Backed by a module-level store rather than per-component state so the
 * header, the Joueurs tab and the Scores tab never disagree about whether
 * roles are currently on screen.
 */

function readInitial() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== '0';
}

let incognitoValue = readInitial();
const listeners = new Set();

function setIncognitoValue(next) {
  if (next === incognitoValue) return;
  incognitoValue = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Private browsing — the in-memory value still works for this session
  }
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return incognitoValue;
}

export function useIncognito() {
  const incognito = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const setIncognito = useCallback((next) => {
    setIncognitoValue(typeof next === 'function' ? next(incognitoValue) : next);
  }, []);

  const toggleIncognito = useCallback(() => setIncognitoValue(!incognitoValue), []);

  return { incognito, setIncognito, toggleIncognito };
}
