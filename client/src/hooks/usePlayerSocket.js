import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Socket.IO hook for the player interface.
 * Connects with the player's session token and listens to game events.
 * Handles reconnection: on reconnect, re-emits player:join to get
 * a fresh state:sync from the server (all state rebuilt from SQLite).
 *
 * Also fires a synthetic 'socket:reconnected' event that the PlayerContext
 * uses to trigger an HTTP re-fetch of /api/player/me.
 */
export function usePlayerSocket() {
  const socketRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const listenersRef = useRef({});
  const wasConnectedRef = useRef(false);

  const connect = useCallback((sessionToken) => {
    if (socketRef.current?.connected) return;
    if (!sessionToken) return;

    sessionTokenRef.current = sessionToken;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      // On every (re)connect, identify as this player
      socket.emit('player:join', { sessionToken: sessionTokenRef.current });

      // Fire reconnect event if this is a reconnection (not first connect)
      if (wasConnectedRef.current) {
        const listeners = listenersRef.current['socket:reconnected'];
        if (listeners) {
          for (const fn of listeners) fn();
        }
      }
      wasConnectedRef.current = true;
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Listen to all player-relevant events
    const events = [
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
    ];

    for (const event of events) {
      socket.on(event, (data) => {
        // Update internal game state for state:sync
        if (event === 'state:sync') {
          setGameState(data);
        }

        // Call registered listeners
        const listeners = listenersRef.current[event];
        if (listeners) {
          for (const fn of listeners) fn(data);
        }
      });
    }

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setGameState(null);
      sessionTokenRef.current = null;
      wasConnectedRef.current = false;
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);

    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter(
        (fn) => fn !== callback
      );
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connected, gameState, on, connect, disconnect };
}
