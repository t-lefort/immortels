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
 * roles are currently on screen — including the rows revealed one by one,
 * which are part of the same store: switching the mode off and back on has to
 * hide everything again, not leave a hand-picked row exposed on another tab.
 */

function readInitial() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== '0';
}

let incognitoValue = readInitial();
let peekedValue = new Set();
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

function setIncognitoValue(next) {
  if (next === incognitoValue) return;
  incognitoValue = next;
  // Any switch of the mode wipes the manual reveals: "masquer les rôles"
  // must mean every role, not every role except the ones already peeked at.
  peekedValue = new Set();
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Private browsing — the in-memory value still works for this session
  }
  notify();
}

function togglePeekedValue(id) {
  const next = new Set(peekedValue);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  peekedValue = next;
  notify();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return incognitoValue;
}

function getPeekedSnapshot() {
  return peekedValue;
}

export function useIncognito() {
  const incognito = useSyncExternalStore(subscribe, getSnapshot, () => true);
  const peeked = useSyncExternalStore(subscribe, getPeekedSnapshot, () => peekedValue);

  const setIncognito = useCallback((next) => {
    setIncognitoValue(typeof next === 'function' ? next(incognitoValue) : next);
  }, []);

  const toggleIncognito = useCallback(() => setIncognitoValue(!incognitoValue), []);

  /** Reveal a single row, or hide it again if it is already revealed. */
  const togglePeek = useCallback((id) => togglePeekedValue(id), []);

  const isPeeked = useCallback((id) => peeked.has(id), [peeked]);

  return { incognito, setIncognito, toggleIncognito, peeked, togglePeek, isPeeked };
}
