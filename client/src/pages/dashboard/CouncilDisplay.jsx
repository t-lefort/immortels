import { useState, useEffect, useRef } from 'react';

/**
 * CouncilDisplay — Village council overlay.
 * Shows speech order with current speaker highlighted + countdown,
 * or 10-minute free debate timer, or vote progress during voting.
 */
export default function CouncilDisplay({ currentPhase, speechOrder, timer, voteProgress, players }) {
  const alivePlayers = players.filter(p => p.status === 'alive');
  const isSmallGroup = alivePlayers.length <= 10;
  const isVoting = currentPhase?.status === 'voting';

  // Track current speaker index (auto-advance with timer)
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);

  // Timer countdown
  const [timeRemaining, setTimeRemaining] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!timer) {
      setTimeRemaining(null);
      return;
    }

    const startTime = timer.startedAt || Date.now();
    const duration = timer.duration;

    const update = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    update();
    intervalRef.current = setInterval(update, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isUrgent = timeRemaining !== null && timeRemaining <= 10 && timeRemaining > 0;

  const votePercent = voteProgress.total > 0
    ? Math.round((voteProgress.count / voteProgress.total) * 100)
    : 0;

  return (
    <div
      className="absolute inset-0 z-10 animate-fadeIn flex flex-col items-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(30, 25, 10, 0.97) 0%, rgba(13, 13, 13, 0.98) 70%)',
      }}
    >
      {/* Top label */}
      <div className="mt-[3vh] mb-[2vh] text-center">
        <span
          className="uppercase tracking-[0.4em] font-bold"
          style={{
            fontSize: '1.5vw',
            color: '#e0a030',
          }}
        >
          Conseil du Village
        </span>
      </div>

      {/* ─── Voting display ────────────────────────────────────────── */}
      {isVoting ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* VOTE EN COURS */}
          <div className="animate-votePulse mb-[4vh]">
            <h2
              className="font-bold uppercase tracking-[0.3em]"
              style={{
                fontSize: '4vw',
                color: '#e0a030',
                textShadow: '0 0 30px rgba(224, 160, 48, 0.4)',
              }}
            >
              Vote en cours
            </h2>
          </div>

          {/* Vote progress */}
          <div style={{ width: '50vw' }}>
            <div className="text-center mb-[1.5vh]">
              <span
                className="text-white font-bold"
                style={{ fontSize: '2.5vw' }}
              >
                {voteProgress.count}
              </span>
              <span className="text-gray-400 mx-[0.5vw]" style={{ fontSize: '1.5vw' }}>/</span>
              <span
                className="text-gray-300 font-medium"
                style={{ fontSize: '2vw' }}
              >
                {voteProgress.total}
              </span>
              <span className="text-gray-500 ml-[0.8vw]" style={{ fontSize: '1.3vw' }}>
                votes
              </span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '1.2vh',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '0.6vh',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${votePercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #b8860b, #e0a030)',
                  borderRadius: '0.6vh',
                  transition: 'width 0.5s ease-out',
                }}
              />
            </div>
          </div>
        </div>
      ) : isSmallGroup ? (
        /* ─── Free debate (<=10 alive) ────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2
            className="text-gray-300 font-medium mb-[3vh]"
            style={{ fontSize: '2vw' }}
          >
            Débat libre
          </h2>

          {/* Timer */}
          <div
            className={isUrgent ? 'animate-countdownPulse' : ''}
          >
            <span
              className="font-mono font-bold tabular-nums"
              style={{
                fontSize: '8vw',
                color: isUrgent ? '#ff4444' : '#e0a030',
                textShadow: isUrgent
                  ? '0 0 30px rgba(255, 68, 68, 0.5)'
                  : '0 0 20px rgba(224, 160, 48, 0.3)',
                transition: 'color 0.3s ease',
              }}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          {timeRemaining === 0 && (
            <p
              className="text-wolf font-bold mt-[2vh] animate-pulse"
              style={{ fontSize: '2vw' }}
            >
              Temps écoulé !
            </p>
          )}
        </div>
      ) : (
        /* ─── Speech order (>10 alive) ────────────────────────────── */
        <div className="flex-1 flex flex-col items-center px-[3vw] w-full overflow-hidden">
          {/* Timer for current speaker */}
          {timer && timeRemaining !== null && (
            <div
              className={`mb-[2vh] ${isUrgent ? 'animate-countdownPulse' : ''}`}
            >
              <span
                className="font-mono font-bold tabular-nums"
                style={{
                  fontSize: '4vw',
                  color: isUrgent ? '#ff4444' : '#e0a030',
                  textShadow: isUrgent
                    ? '0 0 20px rgba(255, 68, 68, 0.4)'
                    : '0 0 15px rgba(224, 160, 48, 0.2)',
                }}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}

          {/* Speech order list */}
          <div
            className="flex-1 w-full flex flex-col gap-[0.6vh] overflow-hidden"
            style={{ maxWidth: '60vw' }}
          >
            {speechOrder && speechOrder.length > 0 ? (
              speechOrder.map((speaker, index) => {
                const isCurrent = index === currentSpeakerIndex;
                const isPast = index < currentSpeakerIndex;

                return (
                  <div
                    key={speaker.id}
                    className="flex items-center gap-[1vw] animate-slideInLeft transition-all duration-300"
                    style={{
                      animationDelay: `${index * 60}ms`,
                      animationFillMode: 'both',
                      padding: '0.6vw 1.5vw',
                      borderRadius: '0.4vw',
                      background: isCurrent
                        ? 'rgba(224, 160, 48, 0.15)'
                        : 'rgba(255,255,255,0.02)',
                      border: isCurrent
                        ? '2px solid rgba(224, 160, 48, 0.5)'
                        : '1px solid rgba(255,255,255,0.05)',
                      opacity: isPast ? 0.4 : 1,
                    }}
                    onClick={() => setCurrentSpeakerIndex(index)}
                  >
                    {/* Number */}
                    <span
                      className="font-bold shrink-0"
                      style={{
                        fontSize: '1.3vw',
                        color: isCurrent ? '#e0a030' : 'rgba(255,255,255,0.3)',
                        width: '2vw',
                        textAlign: 'right',
                      }}
                    >
                      {index + 1}.
                    </span>

                    {/* Name */}
                    <span
                      className="font-medium truncate"
                      style={{
                        fontSize: isCurrent ? '2vw' : '1.5vw',
                        color: isCurrent ? '#fff' : 'rgba(255,255,255,0.6)',
                        textShadow: isCurrent ? '0 0 10px rgba(224, 160, 48, 0.3)' : 'none',
                        transition: 'font-size 0.3s ease',
                      }}
                    >
                      {speaker.name}
                    </span>

                    {/* Current indicator */}
                    {isCurrent && (
                      <span
                        className="animate-pulse ml-auto"
                        style={{
                          fontSize: '1vw',
                          color: '#e0a030',
                        }}
                      >
                        &#9654;
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-center italic" style={{ fontSize: '1.5vw' }}>
                Ordre de parole en attente...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
