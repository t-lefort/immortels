import { useState, useEffect, useMemo } from 'react';

/**
 * ChallengeAnnouncementDisplay -- Cinematic overlay shown when the admin triggers
 * a challenge ("epreuve") display on the dashboard.
 * Full-screen overlay with dramatic text, atmospheric particles, and a
 * pulsing glow. Stays visible until the admin dismisses it.
 */
export default function ChallengeAnnouncementDisplay({ challengeName }) {
  const [revealed, setRevealed] = useState(false);

  // Staggered reveal: label first, then the challenge name
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 1200);
    return () => clearTimeout(timer);
  }, [challengeName]);

  // Decorative floating particles
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 6}s`,
      duration: `${3 + Math.random() * 4}s`,
      size: `${2 + Math.random() * 4}px`,
    }));
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fadeIn"
      style={{
        background:
          'radial-gradient(ellipse at center, rgb(30, 20, 5) 0%, rgb(15, 10, 2) 40%, rgb(5, 5, 5) 100%)',
      }}
    >
      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(218, 165, 32, 0.4)',
            animation: `twinkle ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Top decorative line */}
      <div
        className="animate-slideUp"
        style={{
          width: '30vw',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(218, 165, 32, 0.5), transparent)',
          marginBottom: '4vh',
          animationDelay: '0.3s',
          animationFillMode: 'both',
        }}
      />

      {/* Label */}
      <div
        className="animate-scaleIn"
        style={{
          animationDelay: '0.4s',
          animationFillMode: 'both',
        }}
      >
        <span
          className="uppercase tracking-[0.5em] font-bold"
          style={{
            fontSize: '1.8vw',
            color: 'rgba(218, 165, 32, 0.7)',
            textShadow: '0 0 20px rgba(218, 165, 32, 0.3)',
          }}
        >
          {'\u2694'} {'\u00C9'}preuve {'\u2694'}
        </span>
      </div>

      {/* Challenge name -- large and dramatic */}
      <div
        className="text-center mt-[4vh]"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.9)',
          transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          className="font-bold"
          style={{
            fontSize: '5vw',
            color: '#fff',
            textShadow:
              '0 0 30px rgba(218, 165, 32, 0.4), 0 0 60px rgba(218, 165, 32, 0.2), 0 4px 20px rgba(0,0,0,0.8)',
            lineHeight: 1.2,
            maxWidth: '80vw',
          }}
        >
          {challengeName}
        </h1>
      </div>

      {/* Bottom decorative line */}
      <div
        className="animate-slideUp"
        style={{
          width: '30vw',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(218, 165, 32, 0.5), transparent)',
          marginTop: '4vh',
          animationDelay: '0.6s',
          animationFillMode: 'both',
        }}
      />

      {/* Subtle pulsing border glow at the edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          border: '1px solid rgba(218, 165, 32, 0.1)',
          boxShadow:
            'inset 0 0 100px rgba(218, 165, 32, 0.05), inset 0 0 200px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}
