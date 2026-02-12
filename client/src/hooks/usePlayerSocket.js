import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Module-level singleton socket for the player interface.
 *
 * The socket instance, session token, and listener registry live OUTSIDE
 * React's component lifecycle.  This guarantees exactly ONE socket connection
 * per page load regardless of React StrictMode double-mounting, fast-refresh,
 * or async race conditions in effects.
 *
 * The usePlayerSocket() hook provides a React-friendly API that reads from
 * and writes to these module-level variables.
 */

let _socket = null;           // The one-and-only Socket.IO client instance
let _sessionToken = null;     // Player session token for reconnection
let _wasConnected = false;    // Track if we've connected at least once (for reconnect detection)
const _listeners = {};        // { eventName: Set<callback> }

const EVENTS = [
  'state:sync',
  'game:started',
  'game:end',
  'game:reset',
  'phase:started',
  'phase:voting_opened',
  'phase:voting_closed',
  'phase:vote_update',
  'phase:result',
  'player:eliminated',
  'player:role_assigned',
  'wolves:revealed',
  'timer:start',
  'special:prompt',
  'special:result',
  'speech:order',
  'lobby:update',
  'socket:reconnected', // synthetic event
];

/** Notify all registered listeners for a given event. */
function _fireListeners(event, data) {
  const set = _listeners[event];
  if (set) {
    for (const fn of set) fn(data);
  }
}

/** Create the singleton socket and wire up event handlers. */
function _createSocket(sessionToken, onConnectedChange) {
  // If a socket already exists (connected OR connecting), don't create another.
  if (_socket) return;

  _sessionToken = sessionToken;

  const socket = io({
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    onConnectedChange(true);
    // On every (re)connect, identify as this player
    socket.emit('player:join', { sessionToken: _sessionToken });

    // Fire synthetic reconnect event if this isn't the first connection
    if (_wasConnected) {
      _fireListeners('socket:reconnected');
    }
    _wasConnected = true;
  });

  socket.on('disconnect', () => {
    onConnectedChange(false);
  });

  // Forward all server events to registered listeners
  for (const event of EVENTS) {
    if (event === 'socket:reconnected') continue; // synthetic, not from server
    socket.on(event, (data) => {
      _fireListeners(event, data);
    });
  }

  _socket = socket;
}

/** Tear down the singleton socket completely. */
function _destroySocket(onConnectedChange) {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _sessionToken = null;
    _wasConnected = false;
    onConnectedChange(false);
  }
}

/**
 * Socket.IO hook for the player interface.
 *
 * Uses a module-level singleton so that React StrictMode double-mounts,
 * fast-refresh, and async effect races cannot create duplicate connections.
 *
 * Returns { connected, on, connect, disconnect }.
 */
export function usePlayerSocket() {
  const [connected, setConnected] = useState(false);

  // Keep a ref to the latest setConnected so the module-level callbacks
  // always call the correct React state setter for the ACTIVE hook instance.
  const setConnectedRef = useRef(setConnected);
  setConnectedRef.current = setConnected;

  // Stable callback that module-level code uses to update React state
  const onConnectedChange = useCallback((value) => {
    setConnectedRef.current(value);
  }, []);

  // On mount, sync React state with actual socket state
  useEffect(() => {
    if (_socket?.connected) {
      setConnected(true);
    }
  }, []);

  const connect = useCallback((sessionToken) => {
    if (!sessionToken) return;

    // If the socket exists but the session token changed, tear down and recreate
    if (_socket && _sessionToken !== sessionToken) {
      _destroySocket(onConnectedChange);
    }

    _createSocket(sessionToken, onConnectedChange);
  }, [onConnectedChange]);

  const disconnect = useCallback(() => {
    _destroySocket(onConnectedChange);
  }, [onConnectedChange]);

  const on = useCallback((event, callback) => {
    if (!_listeners[event]) {
      _listeners[event] = new Set();
    }
    _listeners[event].add(callback);

    return () => {
      if (_listeners[event]) {
        _listeners[event].delete(callback);
      }
    };
  }, []);

  // NOTE: We intentionally do NOT disconnect on hook unmount.
  // The socket is a page-level singleton — it survives React re-mounts.
  // It is only torn down when disconnect() is explicitly called (e.g., game reset)
  // or when the page itself unloads.

  return { connected, on, connect, disconnect };
}
