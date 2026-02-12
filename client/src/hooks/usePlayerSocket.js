import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Socket.IO hook for the player interface.
 * Connects with the player's session token and listens to game events.
 */
export function usePlayerSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const listenersRef = useRef({});

  const connect = useCallback((sessionToken) => {
    if (socketRef.current?.connected) return;
    if (!sessionToken) return;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('player:join', { sessionToken });
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
      'role:revealed',
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
