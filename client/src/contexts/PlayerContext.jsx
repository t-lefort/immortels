import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePlayerSocket } from '../hooks/usePlayerSocket.js';
import { useLiveSync } from '../hooks/useLiveSync.js';
import * as playerApi from '../services/playerApi.js';
import { useToast } from './ToastContext.jsx';
import { initSessionOverride, getOverrideToken } from '../services/sessionOverride.js';

const PlayerContext = createContext(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
}

export function PlayerProvider({ children }) {
  const toast = useToast();

  // Core player data
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game state
  const [gameStatus, setGameStatus] = useState('setup');
  const [currentPhase, setCurrentPhase] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hasVoted, setHasVoted] = useState({});
  const [voteCount, setVoteCount] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [wolves, setWolves] = useState([]);
  const [eliminated, setEliminated] = useState([]);
  const [timerDuration, setTimerDuration] = useState(null);
  const [specialPrompt, setSpecialPrompt] = useState(null);
  const [specialResult, setSpecialResult] = useState(null);
  const [phaseResult, setPhaseResult] = useState(null);
  const [roleRevealed, setRoleRevealed] = useState(null);
  const [winner, setWinner] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);

  // Track session token for socket reconnection
  const sessionTokenRef = useRef(null);

  // Stable boolean to gate socket listener registration without
  // re-running the effect on every player state change.
  // We derive this from player?.id so listeners are registered once
  // on login and torn down on logout, but NOT re-registered on every
  // setPlayer() call (which would cause event listener churn and lost events).
  const playerLoggedIn = !!player?.id;

  const { connected, on, connect, disconnect, getSocket } = usePlayerSocket();

  // A locked phone is the normal state of a player between two phases: the tab
  // must catch up the moment it is looked at again, without a manual reload.
  // The page-reload fallback is held back while a vote is open — a reload there
  // would throw away a selection the player has not confirmed yet.
  useLiveSync(getSocket, {
    canReload: () => currentPhase?.status !== 'voting',
  });

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * Shared tail of login/register: pull the full player payload and open the
   * socket. The session cookie is deliberately not httpOnly so the client can
   * read it here and hand it to Socket.IO — it identifies a player, it is not
   * an admin credential.
   */
  const completeAuth = useCallback(async () => {
    const me = await playerApi.getMe();
    setPlayer(me);
    setGameStatus(me.gameStatus || 'setup');
    setCurrentPhase(me.currentPhase || null);
    setHasVoted(me.hasVoted || {});

    const token = getOverrideToken() || getCookie('session_token');
    if (token) {
      sessionTokenRef.current = token;
      connect(token);
    }
    return me;
  }, [connect]);

  const login = useCallback(async (username, password) => {
    setError(null);
    try {
      const result = await playerApi.loginAccount(username, password);
      await completeAuth();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [completeAuth]);

  const register = useCallback(async (account) => {
    setError(null);
    try {
      const result = await playerApi.registerAccount(account);
      await completeAuth();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [completeAuth]);

  const vote = useCallback(async (targetId) => {
    try {
      const result = await playerApi.submitVote(targetId);
      setHasVoted((prev) => ({ ...prev, [result.voteType]: true }));
      toast.success('Vote enregistre');
      return result;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    }
  }, [toast]);

  const villagerGuess = useCallback(async (targetId) => {
    try {
      const result = await playerApi.submitVillagerGuess(targetId);
      setHasVoted((prev) => ({ ...prev, villager_guess: true }));
      toast.success('Vote enregistre');
      return result;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    }
  }, [toast]);

  const ghostIdentify = useCallback(async (targetIds) => {
    try {
      const result = await playerApi.submitGhostIdentification(targetIds);
      setHasVoted((prev) => ({ ...prev, ghost_identify: true }));
      toast.success('Identification enregistree');
      return result;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    }
  }, [toast]);

  const submitSpecialResponse = useCallback(async (type, response) => {
    try {
      const result = await playerApi.submitSpecialResponse(type, response);
      // Clear the prompt after successful response
      setSpecialPrompt(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const markRoleSeen = useCallback(async () => {
    try {
      await playerApi.markRoleSeen();
      setPlayer((prev) => prev ? { ...prev, role_seen: 1 } : prev);
    } catch {
      // Ignore errors — localStorage fallback still works
    }
  }, []);

  const fetchWolves = useCallback(async () => {
    try {
      const data = await playerApi.getWolves();
      setWolves(data.wolves);
    } catch {
      // Not a wolf, or game not started — ignore
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const clearPhaseResult = useCallback(() => setPhaseResult(null), []);

  // ─── Auto-reconnect on page reload ────────────────────────────────────────

  useEffect(() => {
    // `ignore` flag prevents stale async completions from executing after
    // the effect cleanup runs.  This is critical for React StrictMode which
    // mounts → unmounts → mounts, causing the first mount's async work to
    // complete after the second mount has already started.
    let ignore = false;

    async function tryReconnect() {
      // If ?as=PlayerName is in the URL, resolve the override token first.
      // This must happen before any API call so that playerApi.js can
      // attach the X-Session-Token header.
      await initSessionOverride();
      if (ignore) return;

      try {
        const me = await playerApi.getMe();
        if (ignore) return;

        setPlayer(me);
        setGameStatus(me.gameStatus || 'setup');
        setCurrentPhase(me.currentPhase || null);
        setHasVoted(me.hasVoted || {});
        setError(null);

        // Connect socket — use override token if active, otherwise cookie
        const token = getOverrideToken() || getCookie('session_token');
        if (token) {
          sessionTokenRef.current = token;
          connect(token);
        }

        // Fetch wolves if applicable
        if (me.role === 'wolf' && me.gameStatus !== 'setup') {
          try {
            const wolvesData = await playerApi.getWolves();
            if (!ignore) setWolves(wolvesData.wolves);
          } catch {
            // ignore
          }
        }

        // Fetch scoreboard if game already finished (page reload after game:end)
        if (me.gameStatus === 'finished') {
          try {
            const sbData = await playerApi.getScoreboard();
            if (!ignore) {
              setScoreboard(sbData.scoreboard);
              if (sbData.winner) setWinner(sbData.winner);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (ignore) return;
        // No valid session — player needs to login
        setPlayer(null);
        // Only set error for network issues, not for 401s (which just means no session)
        if (err.message && !err.message.includes('401') && !err.message.includes('Session invalide')) {
          setError('Impossible de se connecter au serveur. Vérifiez votre connexion.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    tryReconnect();

    return () => {
      ignore = true;
    };
  }, [connect]);

  // ─── Socket event listeners ───────────────────────────────────────────────

  useEffect(() => {
    if (!playerLoggedIn) return;

    const unsubs = [
      // On socket reconnection, re-fetch full state via HTTP
      on('socket:reconnected', async () => {
        try {
          const me = await playerApi.getMe();
          setPlayer((prev) => ({ ...prev, ...me }));
          setGameStatus(me.gameStatus || 'setup');
          setCurrentPhase(me.currentPhase || null);
          setHasVoted(me.hasVoted || {});
          setError(null);
          toast.info('Connexion retablie');
          // Re-fetch wolves list for wolf players
          if (me.role === 'wolf' && me.gameStatus !== 'setup') {
            try {
              const wolvesData = await playerApi.getWolves();
              setWolves(wolvesData.wolves);
            } catch { /* ignore */ }
          }
        } catch (err) {
          // Session expired — redirect to login
          if (err.message && (err.message.includes('401') || err.message.includes('Session invalide'))) {
            setPlayer(null);
            setLoading(false);
            setError('Session expirée. Veuillez vous reconnecter.');
            disconnect();
          } else {
            setError('Erreur réseau. Nouvelle tentative en cours...');
          }
        }
      }),

      on('state:sync', (data) => {
        if (data.gameStatus) setGameStatus(data.gameStatus);
        if (data.currentPhase !== undefined) setCurrentPhase(data.currentPhase);
        if (data.players) setPlayers(data.players);
        if (data.player) {
          setPlayer((prev) => ({ ...prev, ...data.player }));
        }
        // hasVoted is an object like { wolf: true } or { villager_guess: true } — preserve it as-is
        if (data.hasVoted !== undefined) setHasVoted(data.hasVoted || {});
        if (data.voteCount !== undefined) setVoteCount(data.voteCount);
        if (data.totalExpected !== undefined) setTotalExpected(data.totalExpected);
        // Restore wolf pack list from state sync (sent to wolf players)
        if (data.wolves) setWolves(data.wolves);
        // Clear any previous errors on successful sync
        setError(null);
      }),

      on('game:started', (data) => {
        setGameStatus('in_progress');
        // Server now sends role in game:started payload
        if (data && data.role) {
          setRoleRevealed(data.role);
          setPlayer((prev) => prev ? { ...prev, role: data.role } : prev);
        }
      }),

      on('game:end', (data) => {
        setGameStatus('finished');
        if (data && data.winner) setWinner(data.winner);
        if (data && data.scoreboard) setScoreboard(data.scoreboard);
      }),

      on('lobby:update', (data) => {
        if (data.players) {
          setPlayers(data.players);
        }
      }),

      // Admin revoked this session (wrong phone, account handed over).
      on('session:revoked', () => {
        setPlayer(null);
        setLoading(false);
        setError('Session fermée par l\'administrateur. Reconnectez-vous.');
        disconnect();
      }),

      on('game:reset', () => {
        setGameStatus('setup');
        setCurrentPhase(null);
        setPlayers([]);
        setHasVoted({});
        setVoteCount(0);
        setTotalExpected(0);
        setWolves([]);
        setEliminated([]);
        setPhaseResult(null);
        setPlayer(null);
        setLoading(false);
        disconnect();
      }),

      on('phase:started', (data) => {
        setCurrentPhase(data.phase);
        setHasVoted({});
        setVoteCount(0);
        setPhaseResult(null);
        // Vibrate on phase start
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
      }),

      on('phase:voting_opened', (data) => {
        setCurrentPhase(data.phase);
        setHasVoted({});
        setVoteCount(0);
        // Vibrate on voting opened
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      }),

      on('phase:voting_closed', (data) => {
        setCurrentPhase(data.phase);
      }),

      on('phase:vote_update', (data) => {
        setVoteCount(data.voteCount);
        setTotalExpected(data.totalExpected);
      }),

      on('phase:result', (data) => {
        setPhaseResult(data);
        setCurrentPhase(null);
        // Update player list with eliminated
        if (data.eliminated) {
          setEliminated((prev) => [...prev, ...data.eliminated]);
          // Update players array so eliminated players show as ghost
          const eliminatedMap = new Map(data.eliminated.map((e) => [e.id, e]));
          setPlayers((prev) =>
            prev.map((p) => {
              const elim = eliminatedMap.get(p.id);
              return elim ? { ...p, status: 'ghost', role: elim.role, special_role: elim.special_role } : p;
            })
          );
          // Refresh player data to update own status if eliminated
          playerApi.getMe().then((me) => {
            setPlayer((prev) => ({
              ...prev,
              status: me.status,
              eliminated_at_phase: me.eliminated_at_phase,
              eliminated_by: me.eliminated_by,
            }));
          }).catch(() => {});
        }
      }),

      on('player:eliminated', (data) => {
        setEliminated((prev) => [...prev, data.player]);
        // Update players array so eliminated player shows as ghost
        if (data.player?.id) {
          const ep = data.player;
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === ep.id ? { ...p, status: 'ghost', role: ep.role, special_role: ep.special_role } : p
            )
          );
        }
        // Refresh own data
        playerApi.getMe().then((me) => {
          setPlayer((prev) => ({
            ...prev,
            status: me.status,
            eliminated_at_phase: me.eliminated_at_phase,
            eliminated_by: me.eliminated_by,
          }));
        }).catch(() => {});
      }),

      on('player:role_assigned', (data) => {
        setPlayer((prev) => ({ ...prev, special_role: data.specialRole }));
      }),

      on('wolves:revealed', (data) => {
        setWolves(data.wolves);
      }),

      on('role:revealed', (data) => {
        setRoleRevealed(data.role);
        setPlayer((prev) => prev ? { ...prev, role: data.role } : prev);
      }),

      on('timer:start', (data) => {
        setTimerDuration(data.duration);
      }),

      on('special:prompt', (data) => {
        setSpecialPrompt(data);
      }),

      on('special:result', (data) => {
        setSpecialResult(data);
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerLoggedIn, on, disconnect]);

  // ─── Context value ────────────────────────────────────────────────────────

  const value = {
    // State
    player,
    loading,
    error,
    connected,
    gameStatus,
    currentPhase,
    players,
    hasVoted,
    voteCount,
    totalExpected,
    wolves,
    eliminated,
    timerDuration,
    specialPrompt,
    specialResult,
    phaseResult,
    roleRevealed,
    winner,
    scoreboard,

    // Actions
    login,
    register,
    vote,
    villagerGuess,
    ghostIdentify,
    submitSpecialResponse,
    fetchWolves,
    markRoleSeen,
    clearError,
    clearPhaseResult,
    setTimerDuration,
    setSpecialPrompt,
    setSpecialResult,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
