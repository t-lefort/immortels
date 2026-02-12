import { useState, useEffect, useRef } from 'react';

/**
 * Countdown timer display.
 * Receives duration in seconds, counts down client-side.
 * Large display, pulsing animation when < 10s.
 */
export default function CountdownTimer({ duration, onComplete }) {
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    setRemaining(duration);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);

      if (left <= 0) {
        clearInterval(intervalRef.current);
        if (onComplete) onComplete();
      }
    }, 250); // update 4x per second for smooth display

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 10 && remaining > 0;

  return (
    <div className={`text-center ${isUrgent ? 'animate-pulse' : ''}`}>
      <div
        className={`
          font-mono font-bold tabular-nums
          ${isUrgent ? 'text-wolf text-5xl' : 'text-white text-4xl'}
          transition-colors duration-300
        `}
      >
        {minutes > 0 && (
          <>
            {String(minutes).padStart(2, '0')}
            <span className="text-gray-500">:</span>
          </>
        )}
        {String(seconds).padStart(2, '0')}
      </div>
      {remaining === 0 && (
        <p className="text-wolf font-medium mt-2 text-lg">Temps écoulé !</p>
      )}
    </div>
  );
}
