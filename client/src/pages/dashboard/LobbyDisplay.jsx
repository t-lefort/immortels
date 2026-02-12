import { useMemo } from 'react';

/**
 * LobbyDisplay — Pre-game projected display.
 * Shows game title with dramatic styling and connected player count.
 */
export default function LobbyDisplay({ playerCount }) {
  // Generate decorative stars for background ambiance
  const stars = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${1.5 + Math.random() * 3}s`,
      size: `${2 + Math.random() * 3}px`,
    }));
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
         style={{ background: 'radial-gradient(ellipse at center, #1a0a0a 0%, #0d0d0d 60%, #000 100%)' }}>

      {/* Background stars */}
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

      {/* Title */}
      <div className="animate-fadeIn text-center z-10">
        <h1
          className="font-bold tracking-[0.3em] uppercase animate-pulseGlow"
          style={{
            fontSize: '5vw',
            color: '#fff',
            textShadow: '0 0 30px rgba(139, 0, 0, 0.5), 0 0 60px rgba(139, 0, 0, 0.2)',
            letterSpacing: '0.4em',
          }}
        >
          Les Immortels
        </h1>

        {/* Decorative line */}
        <div
          className="mx-auto mt-[1.5vw] mb-[2vw]"
          style={{
            width: '30vw',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #8B0000, transparent)',
          }}
        />

        {/* Subtitle */}
        <p
          className="text-gray-400 italic animate-slideUp"
          style={{ fontSize: '1.8vw', animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          Le jeu du Loup-Garou
        </p>
      </div>

      {/* Player count */}
      <div
        className="absolute z-10 animate-slideUp"
        style={{
          bottom: '10vh',
          animationDelay: '1s',
          animationFillMode: 'both',
        }}
      >
        <div
          className="text-center"
          style={{
            background: 'rgba(26, 26, 78, 0.3)',
            border: '1px solid rgba(26, 26, 78, 0.6)',
            borderRadius: '1vw',
            padding: '1.5vw 3vw',
          }}
        >
          <p className="text-white font-bold" style={{ fontSize: '2.5vw' }}>
            {playerCount}
          </p>
          <p className="text-gray-400" style={{ fontSize: '1.3vw' }}>
            {playerCount <= 1 ? 'joueur connecté' : 'joueurs connectés'}
          </p>
        </div>
      </div>

      {/* Waiting indicator */}
      <div
        className="absolute z-10 animate-slideUp"
        style={{
          bottom: '3vh',
          animationDelay: '1.5s',
          animationFillMode: 'both',
        }}
      >
        <p
          className="text-gray-600 animate-pulse"
          style={{ fontSize: '1.2vw' }}
        >
          En attente du début de la partie...
        </p>
      </div>
    </div>
  );
}
