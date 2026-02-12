import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Socket.IO hook for the dashboard display.
 * Connects and joins the 'dashboard' room. Listens to all game events
 * and maintains reactive state for the projected display.
 */
export function useDashboardSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Core game state
  const [gameStatus, setGameStatus] = useState('setup'); // setup | in_progress | finished
  const [players, setPlayers] = useState([]);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);

  // Phase-specific state
  const [voteProgress, setVoteProgress] = useState({ count: 0, total: 0 });
  const [speechOrder, setSpeechOrder] = useState(null);
  const [timer, setTimer] = useState(null);

  // Result / overlay state
  const [phaseResult, setPhaseResult] = useState(null);
  const [eliminatedPlayer, setEliminatedPlayer] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);

  // Overlay control
  const [overlay, setOverlay] = useState(null); // 'night' | 'council' | 'result' | 'timer' | 'end' | null

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('dashboard:join');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // ─── State sync (initial load + reconnect) ──────────────────────
    socket.on('state:sync', (data) => {
      if (data.gameStatus) setGameStatus(data.gameStatus);
      if (data.players) setPlayers(data.players);
      if (data.currentPhase) {
        setCurrentPhase(data.currentPhase);
        // Set overlay based on current phase
        if (data.currentPhase.type === 'night') {
          setOverlay('night');
        } else if (data.currentPhase.type === 'village_council') {
          setOverlay('council');
        }
      }
      if (data.voteCount !== undefined && data.totalExpected !== undefined) {
        setVoteProgress({ count: data.voteCount, total: data.totalExpected });
      }
    });

    // ─── Lobby ──────────────────────────────────────────────────────
    socket.on('lobby:update', (data) => {
      if (data.playerCount !== undefined) setPlayerCount(data.playerCount);
      if (data.players) setPlayers(data.players);
    });

    // ─── Game lifecycle ─────────────────────────────────────────────
    socket.on('game:started', () => {
      setGameStatus('in_progress');
      setOverlay(null);
    });

    socket.on('game:reset', () => {
      setGameStatus('setup');
      setPlayers([]);
      setCurrentPhase(null);
      setVoteProgress({ count: 0, total: 0 });
      setSpeechOrder(null);
      setTimer(null);
      setPhaseResult(null);
      setEliminatedPlayer(null);
      setScoreboard(null);
      setOverlay(null);
      setPlayerCount(0);
    });

    socket.on('game:end', (data) => {
      setGameStatus('finished');
      if (data.scoreboard) setScoreboard(data.scoreboard);
      setOverlay('end');
    });

    // ─── Phase events ───────────────────────────────────────────────
    socket.on('phase:started', (data) => {
      const phase = data.phase;
      setCurrentPhase(phase);
      setPhaseResult(null);
      setEliminatedPlayer(null);
      setVoteProgress({ count: 0, total: 0 });
      setSpeechOrder(null);

      if (phase.type === 'night') {
        setOverlay('night');
      } else if (phase.type === 'village_council') {
        setOverlay('council');
      }
    });

    socket.on('phase:voting_opened', (data) => {
      if (data.phase) setCurrentPhase(data.phase);
    });

    socket.on('phase:voting_closed', (data) => {
      if (data.phase) setCurrentPhase(data.phase);
    });

    socket.on('phase:vote_update', (data) => {
      if (data.voteCount !== undefined && data.totalExpected !== undefined) {
        setVoteProgress({ count: data.voteCount, total: data.totalExpected });
      }
    });

    socket.on('phase:result', (data) => {
      setPhaseResult(data);
      if (data.eliminated && data.eliminated.length > 0) {
        setEliminatedPlayer(data.eliminated[0]);
        // Update players list: mark eliminated players
        setPlayers(prev => prev.map(p => {
          const elim = data.eliminated.find(e => e.id === p.id);
          if (elim) {
            return { ...p, status: 'ghost', role: elim.role };
          }
          return p;
        }));
      }
      setOverlay('result');
    });

    socket.on('player:eliminated', (data) => {
      if (data.player) {
        setEliminatedPlayer(data.player);
        setPlayers(prev => prev.map(p =>
          p.id === data.player.id
            ? { ...p, status: 'ghost', role: data.player.role }
            : p
        ));
      }
    });

    // ─── Timer ──────────────────────────────────────────────────────
    socket.on('timer:start', (data) => {
      setTimer({ duration: data.duration, startedAt: Date.now() });
    });

    // ─── Speech order ───────────────────────────────────────────────
    socket.on('speech:order', (data) => {
      if (data.order) setSpeechOrder(data.order);
    });

    // ─── Special powers (dashboard shows minimal info) ──────────────
    socket.on('special:prompt', () => {
      // Dashboard doesn't act on special prompts
    });

    socket.on('special:result', () => {
      // Dashboard doesn't show special results
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  // Clear overlay manually (for result dismiss, etc.)
  const clearOverlay = useCallback(() => {
    setOverlay(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    gameStatus,
    players,
    currentPhase,
    playerCount,
    voteProgress,
    speechOrder,
    timer,
    phaseResult,
    eliminatedPlayer,
    scoreboard,
    overlay,
    setOverlay,
    clearOverlay,
  };
}
