import { useState, useEffect } from 'react';
import { usePlayer } from '../../contexts/PlayerContext.jsx';
import LoginScreen from './LoginScreen.jsx';
import LobbyScreen from './LobbyScreen.jsx';
import RoleRevealScreen from './RoleRevealScreen.jsx';
import WaitingScreen from './WaitingScreen.jsx';
import NightWolfVote from './NightWolfVote.jsx';
import NightVillagerGuess from './NightVillagerGuess.jsx';
import NightGhostVote from './NightGhostVote.jsx';
import VillageCouncilVote from './VillageCouncilVote.jsx';
import PhaseResultScreen from './PhaseResultScreen.jsx';
import EliminatedScreen from './EliminatedScreen.jsx';
import GameEndScreen from './GameEndScreen.jsx';

/**
 * Main player page — state machine router.
 * Determines which screen to show based on:
 * - game_status (setup/in_progress/finished)
 * - player status (alive/ghost)
 * - current phase type and status
 * - player role (wolf/villager)
 */
export default function PlayerPage() {
  const {
    player,
    loading,
    gameStatus,
    currentPhase,
    phaseResult,
  } = usePlayer();

  // Track if the player has seen the "eliminated" screen this session
  const [eliminatedAcknowledged, setEliminatedAcknowledged] = useState(false);

  // Track if role reveal was seen (localStorage-based, handled inside RoleRevealScreen)
  const [roleRevealDismissed, setRoleRevealDismissed] = useState(false);

  // Check role reveal status on mount and when player changes
  useEffect(() => {
    if (player?.id) {
      const seen = localStorage.getItem(`role_seen_${player.id}`);
      setRoleRevealDismissed(!!seen);
    }
  }, [player?.id]);

  // Poll for role reveal dismissal (since localStorage doesn't trigger re-renders)
  useEffect(() => {
    if (roleRevealDismissed || !player?.id) return;
    const interval = setInterval(() => {
      const seen = localStorage.getItem(`role_seen_${player.id}`);
      if (seen) {
        setRoleRevealDismissed(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [roleRevealDismissed, player?.id]);

  // Reset eliminated acknowledgment when player status changes to ghost
  // (so we show the transition once)
  useEffect(() => {
    if (player?.status === 'ghost') {
      const ackKey = `ghost_ack_${player.id}`;
      const alreadyAcked = localStorage.getItem(ackKey);
      if (alreadyAcked) {
        setEliminatedAcknowledged(true);
      }
    }
  }, [player?.status, player?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400 text-lg">Chargement...</div>
      </div>
    );
  }

  // ─── Not logged in ──────────────────────────────────────────────────────────
  if (!player) {
    return <LoginScreen />;
  }

  // ─── Game finished ──────────────────────────────────────────────────────────
  if (gameStatus === 'finished') {
    return <GameEndScreen />;
  }

  // ─── Setup / Lobby ──────────────────────────────────────────────────────────
  if (gameStatus === 'setup') {
    return <LobbyScreen />;
  }

  // ─── Game in progress ───────────────────────────────────────────────────────

  // Show role reveal if game just started and player hasn't seen it
  if (gameStatus === 'in_progress' && player.role && !roleRevealDismissed) {
    return (
      <>
        <RoleRevealScreen />
        {/* RoleRevealScreen is a fixed overlay; when dismissed it returns null
            and the effect above will pick up the localStorage change */}
        <WaitingScreen />
      </>
    );
  }

  // Show eliminated transition if player just became a ghost
  if (player.status === 'ghost' && !eliminatedAcknowledged) {
    return (
      <EliminatedScreen
        onContinue={() => {
          setEliminatedAcknowledged(true);
          localStorage.setItem(`ghost_ack_${player.id}`, '1');
        }}
      />
    );
  }

  // Show phase result if available (between phases)
  if (phaseResult) {
    return <PhaseResultScreen />;
  }

  // ─── Active phase routing ─────────────────────────────────────────────────

  if (currentPhase && currentPhase.status === 'voting') {
    // Night phase
    if (currentPhase.type === 'night') {
      // Ghost players
      if (player.status === 'ghost') {
        return <NightGhostVote />;
      }
      // Wolf players
      if (player.role === 'wolf') {
        return <NightWolfVote />;
      }
      // Villager players
      return <NightVillagerGuess />;
    }

    // Village council phase
    if (currentPhase.type === 'village_council') {
      // Only alive players vote at council
      if (player.status === 'alive') {
        return <VillageCouncilVote />;
      }
      // Ghosts just wait during council
      return <WaitingScreen />;
    }
  }

  // ─── Default: waiting ─────────────────────────────────────────────────────
  return <WaitingScreen />;
}
