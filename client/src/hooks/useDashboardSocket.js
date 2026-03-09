import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Socket.IO hook for the dashboard display.
 * Connects and joins the 'dashboard' room. Listens to all game events
 * and maintains reactive state for the projected display.
 * Handles reconnection: on reconnect, re-emits dashboard:join to get
 * a fresh state:sync from the server (all state rebuilt from SQLite).
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
  const [winner, setWinner] = useState(null);

  // Challenge display state
  const [challengeDisplay, setChallengeDisplay] = useState(null);

  // Hunter kill display state
  const [hunterKill, setHunterKill] = useState(null);

  // Council vote reveal data (who voted for whom)
  const [councilVotes, setCouncilVotes] = useState(null);

  // Overlay control
  const [overlay, setOverlay] = useState(null); // 'night' | 'council' | 'result' | 'timer' | 'end' | null

  const connect = useCallback(() => {
    if (socketRef.current) return; // Guard against duplicate sockets (including connecting state)

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      // On every (re)connect, identify as dashboard
      socket.emit('dashboard:join');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // ─── State sync (initial load + reconnect) ──────────────────────
    socket.on('state:sync', (data) => {
      if (data.gameStatus) setGameStatus(data.gameStatus);
      if (data.players) setPlayers(data.players);
      if (data.playerCount !== undefined) setPlayerCount(data.playerCount);
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
      // Recover timer state on reconnect
      if (data.timerState && data.timerState.remaining > 0) {
        setTimer({
          duration: data.timerState.duration,
          remaining: data.timerState.remaining,
          startedAt: Date.now(),
        });
      }
      // Recover challenge display state on reconnect
      if (data.challengeDisplayName) {
        setChallengeDisplay({ name: data.challengeDisplayName });
        setOverlay('challenge');
      }
    });

    // ─── Lobby ──────────────────────────────────────────────────────
    socket.on('lobby:update', (data) => {
      if (data.playerCount !== undefined) setPlayerCount(data.playerCount);
      if (data.players) {
        // Merge incoming lobby data with existing player data to preserve
        // fields like status and special_role that lobby:update doesn't include.
        // Without this merge, a player reconnecting mid-game would cause
        // lobby:update to overwrite the rich player list with {id, name} only,
        // making all player names disappear from the dashboard game display.
        setPlayers((prev) => {
          if (prev.length === 0) return data.players;
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          return data.players.map((p) => ({ ...prevMap.get(p.id), ...p }));
        });
      }
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
      setWinner(null);
      setChallengeDisplay(null);
      setHunterKill(null);
      setCouncilVotes(null);
      setOverlay(null);
      setPlayerCount(0);
    });

    socket.on('game:end', (data) => {
      setGameStatus('finished');
      if (data.scoreboard) setScoreboard(data.scoreboard);
      if (data.winner) setWinner(data.winner);
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
      setTimer(null); // Clear any previous timer to prevent stacking

      if (phase.type === 'night') {
        setOverlay('night');
      } else if (phase.type === 'village_council') {
        setOverlay('council');
      }
    });

    socket.on('phase:voting_opened', (data) => {
      if (data.phase) setCurrentPhase(data.phase);
      setTimer(null); // Clear debate/speech timer when voting opens
    });

    socket.on('phase:voting_closed', (data) => {
      if (data.phase) setCurrentPhase(data.phase);
      setTimer(null); // Clear any timer when voting closes
    });

    socket.on('phase:vote_update', (data) => {
      if (data.voteCount !== undefined && data.totalExpected !== undefined) {
        setVoteProgress({ count: data.voteCount, total: data.totalExpected });
      }
    });

    socket.on('phase:result', (data) => {
      setPhaseResult(data);
      setTimer(null); // Clear any running timer when result is revealed
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
      // Store council votes if present (for vote reveal after result display)
      if (data.councilVotes && data.councilVotes.length > 0) {
        setCouncilVotes(data.councilVotes);
      } else {
        setCouncilVotes(null);
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

    // ─── Hunter kill display ────────────────────────────────────
    socket.on('dashboard:hunter_kill', (data) => {
      setHunterKill(data);
      setOverlay('hunter');
    });

    // ─── Challenge display ──────────────────────────────────────────
    socket.on('dashboard:challenge', (data) => {
      if (data.name) {
        setChallengeDisplay({ name: data.name });
        setOverlay('challenge');
      }
    });

    socket.on('dashboard:challenge_clear', () => {
      setChallengeDisplay(null);
      setOverlay(null);
    });

    // ─── Vote reveal dismiss ─────────────────────────────────────────
    socket.on('dashboard:vote_reveal_dismiss', () => {
      setCouncilVotes(null);
      setOverlay(null);
    });

    // ─── Force return to base view (player list) ──────────────────
    socket.on('dashboard:force_home', () => {
      setOverlay(null);
      setPhaseResult(null);
      setEliminatedPlayer(null);
      setChallengeDisplay(null);
      setCouncilVotes(null);
      setTimer(null);
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

  // Fetch initial state via REST API so the dashboard has data immediately,
  // without waiting for the socket connection + dashboard:join round-trip.
  // This fixes the "0 en vie" / empty dashboard on first load.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/game/state')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        if (data.gameStatus) setGameStatus(data.gameStatus);
        if (data.players) {
          setPlayers(data.players);
          setPlayerCount(data.players.length);
        }
        if (data.currentPhase) {
          setCurrentPhase(data.currentPhase);
          if (data.currentPhase.type === 'night') {
            setOverlay('night');
          } else if (data.currentPhase.type === 'village_council') {
            setOverlay('council');
          }
        }
        if (data.voteCount !== undefined && data.totalExpected !== undefined) {
          setVoteProgress({ count: data.voteCount, total: data.totalExpected });
        }
      })
      .catch(() => {
        // Silently ignore — socket state:sync will fill in data
      });
    return () => { cancelled = true; };
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
    winner,
    challengeDisplay,
    hunterKill,
    councilVotes,
    overlay,
    setOverlay,
    clearOverlay,
  };
}
