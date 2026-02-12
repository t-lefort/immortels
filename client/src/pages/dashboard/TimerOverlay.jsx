import { useState, useEffect, useRef } from 'react';

/**
 * TimerOverlay — Semi-transparent countdown overlay.
 * Large centered countdown numbers with pulsing effect when < 10 seconds.
 * Doesn't hide content below.
 */
export default function TimerOverlay({ timer, onComplete }) {
  const [remaining, setRemaining] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!timer) {
      setRemaining(null);
      return;
    }

    const startTime = timer.startedAt || Date.now();
    const duration = timer.duration;

    const update = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);

      if (left <= 0) {
        clearInterval(intervalRef.current);
        if (onComplete) onComplete();
      }
    };

    update();
    intervalRef.current = setInterval(update, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer, onComplete]);

  if (remaining === null || remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 10;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-fadeIn"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        className={isUrgent ? 'animate-countdownPulse' : ''}
        style={{
          textAlign: 'center',
        }}
      >
        <div
          className="font-mono font-bold tabular-nums"
          style={{
            fontSize: '10vw',
            color: isUrgent ? '#ff4444' : 'rgba(255, 255, 255, 0.8)',
            textShadow: isUrgent
              ? '0 0 40px rgba(255, 68, 68, 0.6), 0 0 80px rgba(255, 68, 68, 0.3)'
              : '0 0 30px rgba(255, 255, 255, 0.2)',
            lineHeight: 1,
            transition: 'color 0.3s ease',
          }}
        >
          {minutes > 0 && (
            <>
              {String(minutes).padStart(2, '0')}
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>:</span>
            </>
          )}
          {String(seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
