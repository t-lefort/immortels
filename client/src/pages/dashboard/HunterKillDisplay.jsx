import { useState, useEffect, useRef } from 'react';

/**
 * HunterKillDisplay — Dramatic overlay shown on the dashboard when a hunter dies
 * and takes someone with them. Shows the hunter's identity, then reveals the victim.
 */
export default function HunterKillDisplay({ hunterKill, onDismiss }) {
  const [stage, setStage] = useState('blackout');
  // blackout → hunter_reveal → pause → victim_reveal → role → done
  const [revealedLetters, setRevealedLetters] = useState(0);
  const timerRef = useRef(null);
  const letterTimerRef = useRef(null);

  const hunterName = hunterKill?.hunterName || '';
  const victim = hunterKill?.victim || null;
  const victimName = victim?.name || '';
  const isWolf = victim?.role === 'wolf';

  useEffect(() => {
    setStage('blackout');
    setRevealedLetters(0);

    if (!hunterKill) return;

    // Stage 1: Blackout (1.5s) → reveal hunter identity
    timerRef.current = setTimeout(() => {
      setStage('hunter_reveal');
    }, 1500);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(letterTimerRef.current);
    };
  }, [hunterKill]);

  // Hunter reveal → pause before victim
  useEffect(() => {
    if (stage !== 'hunter_reveal') return;

    timerRef.current = setTimeout(() => {
      setStage('pause');
      setRevealedLetters(0);
    }, 3000);

    return () => clearTimeout(timerRef.current);
  }, [stage]);

  // Pause → victim name typewriter
  useEffect(() => {
    if (stage !== 'pause') return;

    timerRef.current = setTimeout(() => {
      setStage('victim_reveal');
    }, 1200);

    return () => clearTimeout(timerRef.current);
  }, [stage]);

  // Victim name letter-by-letter
  useEffect(() => {
    if (stage !== 'victim_reveal' || !victimName) return;

    let count = 0;
    letterTimerRef.current = setInterval(() => {
      count++;
      setRevealedLetters(count);
      if (count >= victimName.length) {
        clearInterval(letterTimerRef.current);
        timerRef.current = setTimeout(() => setStage('role'), 800);
      }
    }, 120);

    return () => {
      clearInterval(letterTimerRef.current);
      clearTimeout(timerRef.current);
    };
  }, [stage, victimName]);

  // Role shown → done
  useEffect(() => {
    if (stage !== 'role') return;

    timerRef.current = setTimeout(() => {
      setStage('done');
    }, 5000);

    return () => clearTimeout(timerRef.current);
  }, [stage]);

  // Auto-dismiss after done
  useEffect(() => {
    if (stage !== 'done') return;

    timerRef.current = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 2000);

    return () => clearTimeout(timerRef.current);
  }, [stage, onDismiss]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fadeIn"
      style={{ background: '#000' }}
    >
      {/* Blackout - suspense */}
      {stage === 'blackout' && (
        <p
          className="text-gray-700 animate-pulse"
          style={{ fontSize: '1.5vw' }}
        >
          Un coup de feu retentit...
        </p>
      )}

      {/* Hunter identity reveal */}
      {(stage === 'hunter_reveal' || stage === 'pause' || stage === 'victim_reveal' || stage === 'role' || stage === 'done') && (
        <div className="text-center">
          {/* Chasseur badge */}
          <div className="animate-scaleIn mb-[2vh]">
            <span
              className="font-bold uppercase tracking-[0.2em]"
              style={{
                fontSize: '1.8vw',
                padding: '0.5vw 2vw',
                borderRadius: '0.5vw',
                background: 'rgba(180, 83, 9, 0.3)',
                color: '#f59e0b',
                border: '2px solid rgba(180, 83, 9, 0.6)',
                textShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                display: 'inline-block',
              }}
            >
              Chasseur
            </span>
          </div>

          {/* Hunter name */}
          <h1
            className="font-bold animate-slideUp"
            style={{
              fontSize: '4vw',
              color: '#f59e0b',
              textShadow: '0 0 30px rgba(245, 158, 11, 0.3)',
              letterSpacing: '0.05em',
            }}
          >
            {hunterName}
          </h1>

          <p
            className="text-gray-400 mt-[1.5vh] animate-fadeIn"
            style={{
              fontSize: '1.5vw',
              animationDelay: '0.5s',
              animationFillMode: 'both',
            }}
          >
            était le chasseur et emporte quelqu'un dans sa chute...
          </p>

          {/* Victim section */}
          {(stage === 'victim_reveal' || stage === 'role' || stage === 'done') && (
            <div className="mt-[5vh]">
              {/* Crosshair icon */}
              <div
                className="animate-fadeIn mb-[2vh]"
                style={{
                  fontSize: '3vw',
                  animationDelay: '0s',
                  animationFillMode: 'both',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  style={{ width: '3vw', height: '3vw', margin: '0 auto' }}
                >
                  <circle cx="12" cy="12" r="8" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              </div>

              {/* Victim name (typewriter) */}
              <div className="flex justify-center">
                <h2
                  className="font-bold"
                  style={{
                    fontSize: '4.5vw',
                    color: '#fff',
                    textShadow: '0 0 30px rgba(255,255,255,0.2)',
                    letterSpacing: '0.1em',
                    minHeight: '5.5vw',
                  }}
                >
                  {victimName.slice(0, revealedLetters)}
                  {stage === 'victim_reveal' && revealedLetters < victimName.length && (
                    <span
                      className="inline-block"
                      style={{
                        width: '3px',
                        height: '4.5vw',
                        background: 'white',
                        marginLeft: '0.2vw',
                        animation: 'blinkCursor 0.7s step-end infinite',
                        verticalAlign: 'bottom',
                      }}
                    />
                  )}
                </h2>
              </div>

              {/* Victim role badge */}
              {(stage === 'role' || stage === 'done') && (
                <div className="mt-[3vh] animate-scaleIn">
                  <span
                    className="font-bold uppercase tracking-[0.2em]"
                    style={{
                      fontSize: '2.2vw',
                      padding: '0.8vw 2.5vw',
                      borderRadius: '0.5vw',
                      background: isWolf
                        ? 'rgba(139, 0, 0, 0.4)'
                        : 'rgba(26, 26, 78, 0.4)',
                      color: isWolf ? '#ff4444' : '#6a7fdb',
                      border: `2px solid ${isWolf
                        ? 'rgba(139, 0, 0, 0.7)'
                        : 'rgba(26, 26, 78, 0.7)'}`,
                      textShadow: isWolf
                        ? '0 0 20px rgba(255, 68, 68, 0.5)'
                        : '0 0 20px rgba(106, 127, 219, 0.5)',
                      display: 'inline-block',
                    }}
                  >
                    {isWolf ? 'LOUP' : 'VILLAGEOIS'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auto-dismiss indicator */}
      {stage === 'done' && (
        <div
          className="absolute bottom-[3vh] text-gray-700 animate-pulse"
          style={{ fontSize: '1vw' }}
        >
          Passage automatique...
        </div>
      )}
    </div>
  );
}
