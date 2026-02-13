import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Socket.IO hook for the admin interface.
 * Connects with the admin password and listens to all game events.
 * Handles reconnection: on reconnect, re-emits admin:join to get
 * a fresh state:sync from the server (all state rebuilt from SQLite).
 */
export function useAdminSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const listenersRef = useRef({});

  const connect = useCallback(() => {
    if (socketRef.current) return; // Guard against duplicate sockets (including connecting state)

    const password = localStorage.getItem('admin_password');
    if (!password) return;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      // On every (re)connect, identify as admin
      const pwd = localStorage.getItem('admin_password');
      if (pwd) {
        socket.emit('admin:join', { password: pwd });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Forward all game events
    const events = [
      'state:sync',
      'lobby:update',
      'game:started',
      'game:end',
      'game:reset',
      'phase:started',
      'phase:voting_opened',
      'phase:voting_closed',
      'phase:result',
      'phase:vote_update',
      'player:eliminated',
      'player:role_assigned',
      'wolves:revealed',
      'timer:start',
      'speech:order',
      'special:prompt',
      'special:result',
    ];

    for (const event of events) {
      socket.on(event, (data) => {
        setLastEvent({ type: event, data, timestamp: Date.now() });
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
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);

    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter(fn => fn !== callback);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, lastEvent, on, connect, disconnect };
}
