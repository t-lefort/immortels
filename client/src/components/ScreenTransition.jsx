import { useState, useEffect, useRef } from 'react';

/**
 * ScreenTransition — Wraps screen content with fade + slide transitions.
 *
 * When `screenKey` changes, the old content fades/slides out,
 * then the new content fades/slides in.
 *
 * Safety: If the screenKey settles (stops changing) while the component
 * is invisible, a fallback timeout forces it back to visible after 400ms.
 * This prevents the blank-white-page bug caused by rapid state changes
 * clearing intermediate animation timeouts.
 *
 * Props:
 *   screenKey: string — a unique key for the current screen (triggers transition on change)
 *   children: ReactNode — the screen content to render
 */
export default function ScreenTransition({ screenKey, children }) {
  const [displayedKey, setDisplayedKey] = useState(screenKey);
  const [phase, setPhase] = useState('visible'); // 'visible' | 'exiting' | 'entering'
  const exitTimeoutRef = useRef(null);
  const enterTimeoutRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);

  useEffect(() => {
    if (screenKey === displayedKey) {
      // Keys match — ensure we're visible (handles initial mount and rapid changes
      // that settle back to the same key).
      if (phase !== 'visible') {
        setPhase('visible');
      }
      return;
    }

    // screenKey changed — start exit animation
    setPhase('exiting');

    // Clear any pending animation timeouts from previous transitions
    clearTimeout(exitTimeoutRef.current);
    clearTimeout(enterTimeoutRef.current);
    clearTimeout(fallbackTimeoutRef.current);

    exitTimeoutRef.current = setTimeout(() => {
      // Swap to new key and start enter animation
      setDisplayedKey(screenKey);
      setPhase('entering');

      enterTimeoutRef.current = setTimeout(() => {
        setPhase('visible');
      }, 50); // Small delay to trigger CSS enter animation
    }, 200); // Duration of exit animation

    // Fallback: if for any reason we're still not visible after 400ms,
    // force visibility.  This catches edge cases where React re-renders
    // or StrictMode cleanup interfere with the normal animation flow.
    fallbackTimeoutRef.current = setTimeout(() => {
      setDisplayedKey((current) => {
        // Only force if still out of sync
        return current;
      });
      setPhase('visible');
    }, 400);

    return () => {
      clearTimeout(exitTimeoutRef.current);
      clearTimeout(enterTimeoutRef.current);
      clearTimeout(fallbackTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  // If screenKey changed but displayedKey is stale, sync it.
  // This handles the case where the effect cleanup cleared timeouts before
  // they could update displayedKey.
  useEffect(() => {
    if (screenKey !== displayedKey && phase === 'visible') {
      setDisplayedKey(screenKey);
    }
  }, [screenKey, displayedKey, phase]);

  const transitionClasses = {
    visible: 'opacity-100 translate-y-0',
    exiting: 'opacity-0 -translate-y-2',
    entering: 'opacity-0 translate-y-4',
  };

  return (
    <div
      className={`transition-all duration-200 ease-out ${transitionClasses[phase]}`}
    >
      {children}
    </div>
  );
}
