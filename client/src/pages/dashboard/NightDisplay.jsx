import { useState, useEffect, useMemo } from 'react';

/**
 * NightDisplay — Night overlay displayed on top of GameDisplay.
 * Atmospheric sequential text with moon/stars visual effects.
 * Shows vote progress bar during voting.
 */
export default function NightDisplay({ currentPhase, voteProgress }) {
  const [visibleTexts, setVisibleTexts] = useState(0);

  // Atmospheric night texts
  const nightTexts = useMemo(() => [
    'La nuit tombe sur le village...',
    'Les loups se réveillent...',
    'Les villageois rêvent...',
  ], []);

  // Sequential text reveal
  useEffect(() => {
    setVisibleTexts(0);
    const timers = nightTexts.map((_, i) =>
      setTimeout(() => setVisibleTexts(i + 1), 2000 + i * 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, [nightTexts]);

  // Generate stars
  const stars = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 70}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${1 + Math.random() * 4}s`,
      size: `${1 + Math.random() * 3}px`,
    }));
  }, []);

  const isVoting = currentPhase?.status === 'voting';
  const votePercent = voteProgress.total > 0
    ? Math.round((voteProgress.count / voteProgress.total) * 100)
    : 0;

  return (
    <div
      className="absolute inset-0 z-10 animate-nightFall flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 70% 20%, rgba(15,15,50,0.97) 0%, rgba(5,5,20,0.98) 50%, rgba(0,0,0,0.99) 100%)',
      }}
    >
      {/* Stars */}
      <div className="stars-container">
        {stars.map(star => (
          <div
            key={star.id}
            className="star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              '--twinkle-delay': star.delay,
              '--twinkle-duration': star.duration,
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <div
        className="absolute animate-moonRise"
        style={{
          top: '8vh',
          right: '12vw',
          width: '6vw',
          height: '6vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #f5f5dc 0%, #ddd 40%, #bbb 100%)',
          boxShadow: '0 0 40px rgba(245, 245, 220, 0.3), 0 0 80px rgba(245, 245, 220, 0.1)',
        }}
      >
        {/* Moon craters */}
        <div
          style={{
            position: 'absolute',
            width: '1.2vw',
            height: '1.2vw',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.08)',
            top: '25%',
            left: '30%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '0.8vw',
            height: '0.8vw',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.06)',
            top: '55%',
            left: '55%',
          }}
        />
      </div>

      {/* Night label */}
      <div
        className="animate-fadeIn mb-[3vh]"
        style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
      >
        <span
          className="uppercase tracking-[0.5em] font-bold"
          style={{
            fontSize: '1.5vw',
            color: 'rgba(106, 127, 219, 0.6)',
          }}
        >
          Nuit {currentPhase?.id ? `#${currentPhase.id}` : ''}
        </span>
      </div>

      {/* Sequential atmospheric texts */}
      <div className="flex flex-col items-center gap-[2vh] z-10">
        {nightTexts.map((text, i) => (
          <p
            key={i}
            className="italic text-center transition-all duration-1000"
            style={{
              fontSize: '2.5vw',
              color: 'rgba(200, 200, 220, 0.9)',
              opacity: i < visibleTexts ? 1 : 0,
              transform: i < visibleTexts ? 'translateY(0)' : 'translateY(15px)',
              textShadow: '0 0 20px rgba(106, 127, 219, 0.2)',
            }}
          >
            {text}
          </p>
        ))}
      </div>

      {/* Vote progress bar */}
      {isVoting && (
        <div
          className="absolute animate-slideUp"
          style={{
            bottom: '10vh',
            width: '50vw',
            animationDelay: '0.3s',
            animationFillMode: 'both',
          }}
        >
          <div className="text-center mb-[1vh]">
            <span
              className="text-gray-300 font-medium animate-votePulse"
              style={{ fontSize: '1.5vw' }}
            >
              Votes : {voteProgress.count} / {voteProgress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '1vh',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '0.5vh',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${votePercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #1a1a4e, #6a7fdb)',
                borderRadius: '0.5vh',
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
