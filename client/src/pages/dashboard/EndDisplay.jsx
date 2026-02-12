import { useState, useEffect, useRef } from 'react';

/**
 * EndDisplay — Game end scoreboard.
 * Animated ranking from last to first.
 * Top 3 podium with gold/silver/bronze.
 * Final reveal: wolves or villagers victory.
 */
export default function EndDisplay({ scoreboard }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showPodium, setShowPodium] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const timerRef = useRef(null);

  // Sort scoreboard descending by score
  const sorted = scoreboard ? [...scoreboard].sort((a, b) => b.score - a.score) : [];
  // Display order: from last to first (reverse)
  const displayOrder = [...sorted].reverse();

  // Determine victory: count alive wolves
  const aliveWolves = sorted.filter(p => p.role === 'wolf' && p.status === 'alive');
  const wolvesWin = aliveWolves.length > 0;

  // Animate entries one by one
  useEffect(() => {
    if (!scoreboard || scoreboard.length === 0) return;

    let count = 0;
    const total = displayOrder.length;

    const reveal = () => {
      count++;
      setVisibleCount(count);

      if (count >= total) {
        // Show podium after all entries
        timerRef.current = setTimeout(() => setShowPodium(true), 1000);
        // Show victory message after podium
        timerRef.current = setTimeout(() => setShowVictory(true), 2500);
      }
    };

    // Start revealing with delay between entries
    const delays = [];
    for (let i = 0; i < total; i++) {
      // Faster for lower ranks, slower as we approach top
      const delay = i < total - 5 ? 300 : 600;
      const cumulativeDelay = i < total - 5
        ? 800 + i * 300
        : 800 + (total - 5) * 300 + (i - (total - 5)) * 600;

      delays.push(setTimeout(reveal, cumulativeDelay));
    }

    return () => {
      delays.forEach(clearTimeout);
      clearTimeout(timerRef.current);
    };
  }, [scoreboard]);

  // Top 3 for podium
  const top3 = sorted.slice(0, 3);

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze
  const podiumLabels = ['1er', '2ème', '3ème'];
  const podiumHeights = ['18vh', '14vh', '11vh'];

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col animate-fadeIn"
      style={{
        background: 'radial-gradient(ellipse at center top, rgba(30, 20, 0, 0.5) 0%, #000 60%)',
      }}
    >
      {/* Title */}
      <div className="text-center mt-[2vh] mb-[1vh]">
        <h1
          className="font-bold uppercase tracking-[0.3em] animate-pulseGlowWhite"
          style={{
            fontSize: '3vw',
            color: '#fff',
          }}
        >
          Classement Final
        </h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ─── Left: Scrolling ranking ────────────────────────────── */}
        <div
          className="flex flex-col p-[1.5vw] overflow-hidden"
          style={{ width: '50%' }}
        >
          <div className="flex flex-col-reverse gap-[0.3vw] overflow-hidden">
            {displayOrder.map((player, index) => {
              const rank = displayOrder.length - index;
              const isVisible = index < visibleCount;
              const isTop3 = rank <= 3;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-[0.8vw]"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateX(0)' : 'translateX(-40px)',
                    transition: 'all 0.4s ease-out',
                    padding: '0.4vw 1vw',
                    borderRadius: '0.3vw',
                    background: isTop3
                      ? `rgba(${rank === 1 ? '255,215,0' : rank === 2 ? '192,192,192' : '205,127,50'}, 0.08)`
                      : 'rgba(255,255,255,0.02)',
                    border: isTop3
                      ? `1px solid rgba(${rank === 1 ? '255,215,0' : rank === 2 ? '192,192,192' : '205,127,50'}, 0.2)`
                      : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Rank */}
                  <span
                    className="font-bold shrink-0 text-right"
                    style={{
                      fontSize: '1.2vw',
                      width: '2.5vw',
                      color: isTop3
                        ? podiumColors[rank - 1]
                        : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    #{rank}
                  </span>

                  {/* Name */}
                  <span
                    className="font-medium truncate flex-1"
                    style={{
                      fontSize: '1.3vw',
                      color: isTop3 ? '#fff' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {player.name}
                  </span>

                  {/* Role indicator */}
                  <span
                    className="font-bold uppercase shrink-0"
                    style={{
                      fontSize: '0.8vw',
                      color: player.role === 'wolf' ? '#ff4444' : '#6a7fdb',
                    }}
                  >
                    {player.role === 'wolf' ? 'L' : 'V'}
                  </span>

                  {/* Score */}
                  <span
                    className="font-mono font-bold shrink-0"
                    style={{
                      fontSize: '1.3vw',
                      color: isTop3 ? podiumColors[rank - 1] : 'rgba(255,255,255,0.5)',
                      width: '3vw',
                      textAlign: 'right',
                    }}
                  >
                    {player.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Right: Podium + Victory ────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-end pb-[4vh]"
          style={{ width: '50%' }}
        >
          {/* Victory message */}
          {showVictory && (
            <div className="mb-[4vh] animate-celebration text-center">
              <h2
                className="font-bold uppercase tracking-[0.2em]"
                style={{
                  fontSize: '3vw',
                  color: wolvesWin ? '#ff4444' : '#6a7fdb',
                  textShadow: wolvesWin
                    ? '0 0 40px rgba(255, 68, 68, 0.5)'
                    : '0 0 40px rgba(106, 127, 219, 0.5)',
                }}
              >
                {wolvesWin ? 'Victoire des Loups' : 'Victoire des Villageois'}
              </h2>
            </div>
          )}

          {/* Podium */}
          {showPodium && top3.length >= 1 && (
            <div className="flex items-end gap-[1vw]">
              {/* 2nd place (left) */}
              {top3.length >= 2 && (
                <div
                  className="flex flex-col items-center animate-podiumRise"
                  style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                >
                  <span className="text-white font-bold mb-[0.5vh]" style={{ fontSize: '1.3vw' }}>
                    {top3[1].name}
                  </span>
                  <span className="font-mono font-bold mb-[0.5vh]" style={{ fontSize: '1.5vw', color: '#C0C0C0' }}>
                    {top3[1].score} pts
                  </span>
                  <div
                    style={{
                      width: '8vw',
                      height: podiumHeights[1],
                      background: 'linear-gradient(180deg, rgba(192,192,192,0.3) 0%, rgba(192,192,192,0.05) 100%)',
                      border: '1px solid rgba(192,192,192,0.4)',
                      borderRadius: '0.3vw 0.3vw 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="font-bold"
                      style={{ fontSize: '2vw', color: '#C0C0C0' }}
                    >
                      {podiumLabels[1]}
                    </span>
                  </div>
                </div>
              )}

              {/* 1st place (center, tallest) */}
              <div
                className="flex flex-col items-center animate-podiumRise"
                style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
              >
                <span className="text-white font-bold mb-[0.5vh]" style={{ fontSize: '1.6vw' }}>
                  {top3[0].name}
                </span>
                <span className="font-mono font-bold mb-[0.5vh]" style={{ fontSize: '1.8vw', color: '#FFD700' }}>
                  {top3[0].score} pts
                </span>
                <div
                  style={{
                    width: '10vw',
                    height: podiumHeights[0],
                    background: 'linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.05) 100%)',
                    border: '1px solid rgba(255,215,0,0.4)',
                    borderRadius: '0.3vw 0.3vw 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ fontSize: '2.5vw', color: '#FFD700' }}
                  >
                    {podiumLabels[0]}
                  </span>
                </div>
              </div>

              {/* 3rd place (right) */}
              {top3.length >= 3 && (
                <div
                  className="flex flex-col items-center animate-podiumRise"
                  style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                >
                  <span className="text-white font-bold mb-[0.5vh]" style={{ fontSize: '1.2vw' }}>
                    {top3[2].name}
                  </span>
                  <span className="font-mono font-bold mb-[0.5vh]" style={{ fontSize: '1.3vw', color: '#CD7F32' }}>
                    {top3[2].score} pts
                  </span>
                  <div
                    style={{
                      width: '7vw',
                      height: podiumHeights[2],
                      background: 'linear-gradient(180deg, rgba(205,127,50,0.3) 0%, rgba(205,127,50,0.05) 100%)',
                      border: '1px solid rgba(205,127,50,0.4)',
                      borderRadius: '0.3vw 0.3vw 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="font-bold"
                      style={{ fontSize: '1.8vw', color: '#CD7F32' }}
                    >
                      {podiumLabels[2]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
