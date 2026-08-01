import { useEffect, useRef } from 'react';

/** How long a socket may stay down before we give up and reload the page. */
const STALE_RELOAD_MS = 90000;

/** How long the server has to answer a resync before we force a reconnect. */
const RESYNC_TIMEOUT_MS = 5000;

/**
 * Consecutive reloads allowed before giving up. A server that is genuinely
 * down would otherwise turn every screen into a reload loop; socket.io keeps
 * retrying on its own in the background either way.
 */
const MAX_RELOADS = 3;
const RELOAD_KEY = 'livesync_reloads';

function reloadCount() {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return MAX_RELOADS; // No sessionStorage — don't risk the loop.
  }
}

function noteReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(reloadCount() + 1));
  } catch { /* ignore */ }
}

function clearReloads() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch { /* ignore */ }
}

/**
 * Keeps a screen from going stale when its socket quietly dies.
 *
 * A phone that locks, a laptop that sleeps, a wifi/4G handover: the tab comes
 * back with a socket that still *looks* connected, so nothing reconnects and
 * nothing re-syncs — the display sits on the state it had when it went away
 * until someone reloads the page by hand.
 *
 * Three signals trigger a catch-up, plus a slow heartbeat for everything else:
 * the tab becoming visible, the browser reporting the network is back, and the
 * window regaining focus. Each one either reconnects a socket that is down, or
 * asks a socket that is up for a fresh `state:sync` (`client:resync`, rebuilt
 * from SQLite and cheap enough to send on a timer).
 *
 * The resync is sent with a timeout: a socket that answers nothing is a socket
 * that only believes it is connected, and gets torn down and rebuilt. If even
 * that fails to come back for {@link STALE_RELOAD_MS}, the page reloads — the
 * last resort, skipped while `canReload()` is false so a vote in progress is
 * never thrown away.
 *
 * @param {() => import('socket.io-client').Socket | null} getSocket
 * @param {{ intervalMs?: number, canReload?: () => boolean }} options
 */
export function useLiveSync(getSocket, { intervalMs = 20000, canReload } = {}) {
  const getSocketRef = useRef(getSocket);
  getSocketRef.current = getSocket;
  const canReloadRef = useRef(canReload);
  canReloadRef.current = canReload;

  useEffect(() => {
    // Timestamp of the last moment the socket was known to be alive.
    let lastAlive = Date.now();

    function sync() {
      const socket = getSocketRef.current?.();
      if (!socket) return;

      if (!socket.connected) {
        // `connect()` on an already-reconnecting socket is a no-op, so this is
        // safe to call on every wake-up.
        socket.connect();

        if (
          Date.now() - lastAlive > STALE_RELOAD_MS &&
          document.visibilityState === 'visible' &&
          reloadCount() < MAX_RELOADS &&
          (!canReloadRef.current || canReloadRef.current())
        ) {
          noteReload();
          window.location.reload();
        }
        return;
      }

      socket.timeout(RESYNC_TIMEOUT_MS).emit('client:resync', (err) => {
        if (err) {
          // Connected in name only — rebuild the connection from scratch.
          socket.disconnect();
          socket.connect();
          return;
        }
        lastAlive = Date.now();
        clearReloads();
      });
    }

    function onVisible() {
      if (document.visibilityState === 'visible') sync();
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') sync();
    }, intervalMs);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      clearInterval(interval);
    };
  }, [intervalMs]);
}
