import { useState, useEffect } from 'react';

/**
 * ChallengeDisplay — Challenge results overlay.
 * Shows winning team and special power message.
 */
export default function ChallengeDisplay({ challenge, onDismiss }) {
  const [showPower, setShowPower] = useState(false);

  useEffect(() => {
    // Reveal power message after delay
    const timer = setTimeout(() => setShowPower(true), 2500);
    return () => clearTimeout(timer);
  }, [challenge]);

  // Auto-dismiss
  useEffect(() => {
    if (!showPower) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [showPower, onDismiss]);

  const winningTeamNames = challenge?.winningTeamNames || [];

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fadeIn"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(45, 106, 79, 0.15) 0%, rgba(0, 0, 0, 0.98) 70%)',
      }}
    >
      {/* Title */}
      <div className="animate-celebration mb-[4vh]">
        <h1
          className="font-bold uppercase tracking-[0.3em]"
          style={{
            fontSize: '3vw',
            color: '#2d6a4f',
            textShadow: '0 0 30px rgba(45, 106, 79, 0.5)',
          }}
        >
          Épreuve terminée !
        </h1>
      </div>

      {/* Challenge name */}
      {challenge?.name && (
        <p
          className="text-gray-400 mb-[3vh] animate-slideUp"
          style={{
            fontSize: '1.8vw',
            animationDelay: '0.3s',
            animationFillMode: 'both',
          }}
        >
          {challenge.name}
        </p>
      )}

      {/* Winning team */}
      {winningTeamNames.length > 0 && (
        <div
          className="animate-slideUp mb-[4vh]"
          style={{
            animationDelay: '0.6s',
            animationFillMode: 'both',
          }}
        >
          <p
            className="text-gray-400 text-center mb-[1.5vh]"
            style={{ fontSize: '1.3vw' }}
          >
            Équipe gagnante
          </p>
          <div className="flex flex-wrap justify-center gap-[1vw]">
            {winningTeamNames.map((name, i) => (
              <span
                key={i}
                className="font-medium"
                style={{
                  fontSize: '1.8vw',
                  color: '#fff',
                  padding: '0.4vw 1.2vw',
                  background: 'rgba(45, 106, 79, 0.2)',
                  border: '1px solid rgba(45, 106, 79, 0.4)',
                  borderRadius: '0.4vw',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Special power message */}
      {showPower && (
        <div className="animate-scaleIn text-center">
          <div
            style={{
              padding: '1.5vw 3vw',
              background: 'rgba(45, 106, 79, 0.15)',
              border: '2px solid rgba(45, 106, 79, 0.4)',
              borderRadius: '0.5vw',
            }}
          >
            <p
              className="font-bold"
              style={{
                fontSize: '2vw',
                color: '#2d6a4f',
                textShadow: '0 0 15px rgba(45, 106, 79, 0.4)',
              }}
            >
              Un joueur a reçu un pouvoir spécial !
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
