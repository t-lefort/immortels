import { useEffect, useCallback } from 'react';
import { useDashboardSocket } from '../../hooks/useDashboardSocket.js';
import LobbyDisplay from './LobbyDisplay.jsx';
import GameDisplay from './GameDisplay.jsx';
import NightDisplay from './NightDisplay.jsx';
import CouncilDisplay from './CouncilDisplay.jsx';
import ResultDisplay from './ResultDisplay.jsx';
import ChallengeAnnouncementDisplay from './ChallengeAnnouncementDisplay.jsx';
import EndDisplay from './EndDisplay.jsx';
import TimerOverlay from './TimerOverlay.jsx';

/**
 * DashboardPage — Main state machine for the projected dashboard display.
 * Full-screen, no scroll, no interaction elements.
 * 16:9 aspect-ratio container, vw-based text sizing.
 */
export default function DashboardPage() {
  const {
    connected,
    gameStatus,
    players,
    currentPhase,
    playerCount,
    voteProgress,
    speechOrder,
    dashboardSpeechOrder,
    timer,
    phaseResult,
    scoreboard,
    challengeDisplay,
    overlay,
    setOverlay,
    clearOverlay,
  } = useDashboardSocket();

  // Auto-dismiss result overlay after animation completes
  const handleResultDismiss = useCallback(() => {
    clearOverlay();
  }, [clearOverlay]);

  // Auto-dismiss result after the ResultDisplay internal timer
  useEffect(() => {
    if (overlay === 'result' && phaseResult) {
      // Auto-dismiss after generous delay (ResultDisplay has its own internal timing)
      const timer = setTimeout(() => {
        clearOverlay();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [overlay, phaseResult, clearOverlay]);

  // ─── Render state machine ─────────────────────────────────────
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: '#0d0d0d',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Connection indicator (subtle, top-right) */}
      {!connected && (
        <div
          className="absolute top-[1vh] right-[1vw] z-50 flex items-center gap-[0.3vw]"
          style={{ fontSize: '0.8vw' }}
        >
          <div
            className="animate-pulse"
            style={{
              width: '0.5vw',
              height: '0.5vw',
              borderRadius: '50%',
              background: '#ff4444',
            }}
          />
          <span className="text-gray-600">Déconnecté</span>
        </div>
      )}

      {/* ─── Lobby (setup phase) ───────────────────────────────── */}
      {gameStatus === 'setup' && (
        <LobbyDisplay playerCount={playerCount} />
      )}

      {/* ─── In-game (with overlays) ──────────────────────────── */}
      {gameStatus === 'in_progress' && (
        <GameDisplay
          players={players}
          currentPhase={currentPhase}
        >
          {/* Night overlay */}
          {overlay === 'night' && currentPhase?.type === 'night' && (
            <NightDisplay
              currentPhase={currentPhase}
              voteProgress={voteProgress}
            />
          )}

          {/* Council overlay */}
          {overlay === 'council' && currentPhase?.type === 'village_council' && (
            <CouncilDisplay
              currentPhase={currentPhase}
              speechOrder={speechOrder}
              dashboardSpeechOrder={dashboardSpeechOrder}
              timer={timer}
              voteProgress={voteProgress}
              players={players}
            />
          )}

          {/* Result reveal overlay */}
          {overlay === 'result' && phaseResult && (
            <ResultDisplay
              phaseResult={phaseResult}
              onDismiss={handleResultDismiss}
            />
          )}

          {/* Challenge announcement overlay */}
          {overlay === 'challenge' && challengeDisplay && (
            <ChallengeAnnouncementDisplay
              challengeName={challengeDisplay.name}
            />
          )}

          {/* Timer overlay (shows on top of night, but NOT council which has its own timer) */}
          {overlay !== 'result' && overlay !== 'end' && overlay !== 'council' && timer && (
            <TimerOverlay
              key={timer.startedAt}
              timer={timer}
            />
          )}
        </GameDisplay>
      )}

      {/* ─── Game end ─────────────────────────────────────────── */}
      {gameStatus === 'finished' && (
        <EndDisplay scoreboard={scoreboard} />
      )}
    </div>
  );
}
