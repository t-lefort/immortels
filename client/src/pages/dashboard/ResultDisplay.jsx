import { useState, useEffect, useRef } from 'react';

/**
 * ResultDisplay — Dramatic result reveal overlay.
 * Blackout screen, name revealed letter by letter (typewriter),
 * role badge appears with dramatic pause.
 */
export default function ResultDisplay({ phaseResult, onDismiss }) {
  const [stage, setStage] = useState('blackout'); // blackout | name | pause | role | done
  const [revealedLetters, setRevealedLetters] = useState(0);
  const timerRef = useRef(null);
  const letterTimerRef = useRef(null);

  // Get the first eliminated player from the result
  const eliminated = phaseResult?.eliminated?.[0] || null;
  const playerName = eliminated?.name || '';
  const playerRole = eliminated?.role || '';

  // No victims
  const noVictims = !eliminated && phaseResult;

  useEffect(() => {
    // Reset state on new result
    setStage('blackout');
    setRevealedLetters(0);

    if (noVictims) {
      // No one was eliminated — show message after blackout
      timerRef.current = setTimeout(() => setStage('no_victim'), 1500);
      return () => clearTimeout(timerRef.current);
    }

    if (!eliminated) return;

    // Stage 1: Blackout (1.5s)
    timerRef.current = setTimeout(() => {
      setStage('name');
      setRevealedLetters(0);
    }, 1500);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(letterTimerRef.current);
    };
  }, [phaseResult, eliminated, noVictims]);

  // Letter-by-letter reveal
  useEffect(() => {
    if (stage !== 'name' || !playerName) return;

    let count = 0;
    letterTimerRef.current = setInterval(() => {
      count++;
      setRevealedLetters(count);
      if (count >= playerName.length) {
        clearInterval(letterTimerRef.current);
        // Pause before showing role
        timerRef.current = setTimeout(() => setStage('pause'), 800);
      }
    }, 120);

    return () => {
      clearInterval(letterTimerRef.current);
      clearTimeout(timerRef.current);
    };
  }, [stage, playerName]);

  // Dramatic pause then role reveal
  useEffect(() => {
    if (stage !== 'pause') return;

    timerRef.current = setTimeout(() => setStage('role'), 1500);
    return () => clearTimeout(timerRef.current);
  }, [stage]);

  // Auto-dismiss after role is shown for a while
  useEffect(() => {
    if (stage !== 'role' && stage !== 'no_victim') return;

    timerRef.current = setTimeout(() => {
      setStage('done');
    }, 6000);

    return () => clearTimeout(timerRef.current);
  }, [stage]);

  const isWolf = playerRole === 'wolf';

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fadeIn"
      style={{
        background: '#000',
      }}
    >
      {/* No victim message */}
      {stage === 'no_victim' && (
        <div className="animate-slideUp text-center">
          <p
            className="font-bold"
            style={{
              fontSize: '3vw',
              color: '#fff',
              textShadow: '0 0 20px rgba(255,255,255,0.2)',
            }}
          >
            Personne n'a été éliminé
          </p>
          <p
            className="text-gray-500 mt-[2vh]"
            style={{ fontSize: '1.5vw' }}
          >
            Le village est sauf... pour l'instant.
          </p>
        </div>
      )}

      {/* Blackout - just darkness with subtle text */}
      {stage === 'blackout' && eliminated && (
        <p
          className="text-gray-700 animate-pulse"
          style={{ fontSize: '1.5vw' }}
        >
          Le destin a parlé...
        </p>
      )}

      {/* Name reveal - typewriter */}
      {(stage === 'name' || stage === 'pause' || stage === 'role' || stage === 'done') && eliminated && (
        <div className="text-center">
          {/* Subtitle */}
          <p
            className="text-gray-500 mb-[3vh] animate-fadeIn"
            style={{ fontSize: '1.5vw' }}
          >
            {phaseResult?.phase?.type === 'night'
              ? (eliminated?.eliminatedBy === 'ghosts'
                ? 'Les fantômes ont frappé...'
                : 'Les loups ont frappé...')
              : 'Le village a décidé d\'éliminer...'}
          </p>

          {/* Name (typewriter) */}
          <div className="flex justify-center">
            <h1
              className="font-bold"
              style={{
                fontSize: '5vw',
                color: '#fff',
                textShadow: '0 0 30px rgba(255,255,255,0.2)',
                letterSpacing: '0.1em',
                minHeight: '6vw',
              }}
            >
              {playerName.slice(0, revealedLetters)}
              {revealedLetters < playerName.length && (
                <span
                  className="inline-block"
                  style={{
                    width: '3px',
                    height: '5vw',
                    background: 'white',
                    marginLeft: '0.2vw',
                    animation: 'blinkCursor 0.7s step-end infinite',
                    verticalAlign: 'bottom',
                  }}
                />
              )}
            </h1>
          </div>

          {/* Role badge */}
          {(stage === 'role' || stage === 'done') && (
            <div
              className="mt-[4vh] animate-scaleIn"
            >
              <span
                className="font-bold uppercase tracking-[0.2em]"
                style={{
                  fontSize: '2.5vw',
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

          {/* Multiple victims indicator */}
          {(stage === 'role' || stage === 'done') && phaseResult?.eliminated?.length > 1 && (
            <div className="mt-[3vh]">
              {phaseResult.eliminated.slice(1).map((victim, i) => (
                <div key={victim.id} className="animate-slideUp" style={{ animationDelay: `${(i + 1) * 500}ms`, animationFillMode: 'both' }}>
                  <span className="text-gray-500" style={{ fontSize: '1vw' }}>
                    {victim.eliminatedBy === 'ghosts' ? '(fantômes)' : victim.eliminatedBy === 'wolves' ? '(loups)' : ''}
                  </span>
                  <span className="text-gray-400 font-medium ml-[0.5vw]" style={{ fontSize: '2vw' }}>
                    {victim.name}
                  </span>
                  <span
                    className="ml-[1vw] font-bold uppercase"
                    style={{
                      fontSize: '1.2vw',
                      color: victim.role === 'wolf' ? '#ff4444' : '#6a7fdb',
                    }}
                  >
                    {victim.role === 'wolf' ? 'LOUP' : 'VILLAGEOIS'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Done state - click area for admin control */}
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
