import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePlayerSocket } from '../hooks/usePlayerSocket.js';
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

  // Track session token for socket reconnection
  const sessionTokenRef = useRef(null);

  // Stable boolean to gate socket listener registration without
  // re-running the effect on every player state change.
  // We derive this from player?.id so listeners are registered once
  // on login and torn down on logout, but NOT re-registered on every
  // setPlayer() call (which would cause event listener churn and lost events).
  const playerLoggedIn = !!player?.id;

  const { connected, on, connect, disconnect } = usePlayerSocket();

  // ─── Actions ──────────────────────────────────────────────────────────────

  const login = useCallback(async (name) => {
    setError(null);
    try {
      const result = await playerApi.joinGame(name);
      // After join, fetch full player data (server sets cookie)
      const me = await playerApi.getMe();
      setPlayer(me);
      setGameStatus(me.gameStatus || 'setup');
      setCurrentPhase(me.currentPhase || null);
      setHasVoted(me.hasVoted || {});

      // Store session token from cookie for socket
      // We don't have direct access to httpOnly cookie,
      // but the server side associates it. We use a special endpoint.
      // The socket handler reads the token from the player:join event.
      // We'll pass the token from the initial join response or reconnect.
      // Since cookies are httpOnly, we need to ask the server for the token.
      // Actually, the socket uses player:join with sessionToken.
      // The join response doesn't expose the token (httpOnly).
      // We need the server to provide us a way to get the socket token.
      // The pragmatic approach: extract from document.cookie won't work for httpOnly.
      // Instead, let's store a non-httpOnly "socket_token" or pass via response.
      // For now, use the player id to reconnect via a different mechanism,
      // OR modify the join endpoint to return the token (it's the player's own session).

      // The simplest approach: the join response returns enough info.
      // We'll modify our approach - the socket join can use a player ID based approach,
      // or we need the token. Let's return it in the join response for socket use only.
      // Actually, better: read from the response since we control the server.
      // The cleanest approach: return session_token in join response for socket use.
      // But httpOnly cookie is set. Let's store a separate "socketToken" in localStorage.
      // OR: better yet, send the token as a response field too.

      // For now, we'll work around this by storing the token from join response
      // and using it for socket connection. The token is already in the cookie.
      // We can read the raw cookie from response Set-Cookie... but that's blocked by browser.

      // Pragmatic solution: we modify join to also return the token for client socket use.
      // But that somewhat defeats the purpose of httpOnly.
      // Alternative: the socket handler can use a different auth method.

      // Actually, looking at socket-handlers.js, it uses sessionToken from the client.
      // The simplest fix: make the cookie non-httpOnly so JS can read it,
      // OR have the /join endpoint return the token.
      // Since the original code returns the session_token for socket use,
      // and the admin socket uses localStorage password - let's just return token from join.

      // We'll store the token from a custom header or response body.
      // Let's fetch the token via a lightweight mechanism.
      // The cleanest: return sessionToken in join response body.
      // We need to update server-side join to include it.
      // For now, let's use a workaround: call a separate endpoint.

      // WORKAROUND: Read cookie value (non-httpOnly approach)
      // We'll update the server to not set httpOnly for session_token
      // so the client can read it for socket connection.
      // This is acceptable because session_token is not a security-critical secret
      // (it's a player session, not admin auth).

      // Use override token if active, otherwise read from cookie
      const token = getOverrideToken() || getCookie('session_token');
      if (token) {
        sessionTokenRef.current = token;
        connect(token);
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [connect]);

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

    // Actions
    login,
    vote,
    villagerGuess,
    ghostIdentify,
    submitSpecialResponse,
    fetchWolves,
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
