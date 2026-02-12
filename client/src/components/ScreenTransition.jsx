import { useState, useEffect, useRef } from 'react';

/**
 * ScreenTransition — Wraps screen content with fade + slide transitions.
 *
 * When `screenKey` changes, the old content fades/slides out,
 * then the new content fades/slides in.
 *
 * Props:
 *   screenKey: string — a unique key for the current screen (triggers transition on change)
 *   children: ReactNode — the screen content to render
 */
export default function ScreenTransition({ screenKey, children }) {
  const [displayedKey, setDisplayedKey] = useState(screenKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState('visible'); // 'visible' | 'exiting' | 'entering'
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (screenKey !== displayedKey) {
      // Start exit transition
      setPhase('exiting');

      timeoutRef.current = setTimeout(() => {
        // Swap content
        setDisplayedKey(screenKey);
        setDisplayedChildren(children);
        setPhase('entering');

        timeoutRef.current = setTimeout(() => {
          setPhase('visible');
        }, 50); // Small delay to trigger enter animation
      }, 200); // Duration of exit animation
    } else {
      // Same key, just update children directly
      setDisplayedChildren(children);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [screenKey, children, displayedKey]);

  const transitionClasses = {
    visible: 'opacity-100 translate-y-0',
    exiting: 'opacity-0 -translate-y-2',
    entering: 'opacity-0 translate-y-4',
  };

  return (
    <div
      className={`transition-all duration-200 ease-out ${transitionClasses[phase]}`}
    >
      {displayedChildren}
    </div>
  );
}
