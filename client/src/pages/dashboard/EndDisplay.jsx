import { useState, useEffect, useRef } from 'react';

/**
 * EndDisplay — Game end scoreboard.
 * Animated ranking from last to first.
 * Top 3 podium with gold/silver/bronze.
 * Final reveal: wolves or villagers victory.
 */
export default function EndDisplay({ scoreboard, winner: winnerProp }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showPodium, setShowPodium] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Sort scoreboard descending by score
  const sorted = scoreboard ? [...scoreboard].sort((a, b) => b.score - a.score) : [];
  const count = sorted.length;

  // Annotate each entry with:
  //  - rank: competition ranking (ties share a rank, then the next rank is
  //    skipped — e.g. two 3rd places are followed by 5th, not 4th).
  //  - tier: index of the distinct score (0 = best), used for the top-3
  //    podium/highlight so tied players land on the same medal step.
  //  - revealIndex: 0 = lowest score, revealed first (ranking "rises").
  let compRank = 0;
  let tier = -1;
  let lastScore = null;
  const ranked = sorted.map((player, i) => {
    if (i === 0 || player.score !== lastScore) {
      compRank = i + 1;
      tier += 1;
      lastScore = player.score;
    }
    return {
      player,
      rank: compRank,
      tier,
      revealIndex: count - 1 - i,
    };
  });

  // Podium tiers: the top 3 distinct scores. Each tier can hold several tied
  // players who share the same medal step and rank label.
  const podiumGroups = [];
  for (const entry of ranked) {
    if (entry.tier > 2) break;
    if (!podiumGroups[entry.tier]) {
      podiumGroups[entry.tier] = { rank: entry.rank, score: entry.player.score, players: [] };
    }
    podiumGroups[entry.tier].players.push(entry.player);
  }

  // Split the ranking into balanced columns so that, with a large roster, the
  // text stays at full size instead of being shrunk down to fit one column.
  // A single column holds ~18 rows at full size on a 16:9 screen.
  const COL_CAPACITY = 18;
  const numCols = Math.min(3, Math.max(1, Math.ceil(count / COL_CAPACITY)));
  const perCol = Math.ceil(count / numCols) || 1;
  const columns = [];
  for (let c = 0; c < numCols; c++) {
    columns.push(ranked.slice(c * perCol, (c + 1) * perCol));
  }

  // Determine victory: use explicit winner prop or fallback to alive wolves count
  const wolvesWin = winnerProp ? winnerProp === 'wolves' : sorted.filter(p => p.role === 'wolf' && p.status === 'alive').length > 0;

  // Animate entries one by one
  useEffect(() => {
    if (!scoreboard || scoreboard.length === 0) return;

    let revealed = 0;
    const total = sorted.length;

    const reveal = () => {
      revealed++;
      setVisibleCount(revealed);

      if (revealed >= total) {
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

  // Safety net: if the columns still exceed the available height (e.g. a huge
  // roster, or a shorter-than-16:9 screen), scale the whole list down so every
  // player stays visible instead of overflowing off-screen.
  useEffect(() => {
    const recompute = () => {
      const container = containerRef.current;
      const list = listRef.current;
      if (!container || !list) return;
      const available = container.clientHeight;
      const natural = list.scrollHeight;
      if (available > 0 && natural > 0) {
        setFitScale(Math.min(1, available / natural));
      }
    };

    recompute();
    const raf = requestAnimationFrame(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
    };
  }, [scoreboard]);

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze
  const podiumRgb = ['255,215,0', '192,192,192', '205,127,50'];
  const podiumHeights = ['18vh', '14vh', '11vh'];
  const ordinal = (r) => (r === 1 ? '1er' : `${r}ème`);

  // Render one podium step (medal tier). Shows every tied player on the step.
  const renderPodiumStep = (t, { width, nameSize, scoreSize, labelSize, animDelay }) => {
    const group = podiumGroups[t];
    if (!group) return null;
    const color = podiumColors[t];
    const rgb = podiumRgb[t];
    return (
      <div
        className="flex flex-col items-center animate-podiumRise"
        style={{ animationDelay: animDelay, animationFillMode: 'both' }}
      >
        <div className="flex flex-col items-center mb-[0.5vh] leading-tight">
          {group.players.map((p) => (
            <span key={p.id} className="text-white font-bold text-center" style={{ fontSize: nameSize }}>
              {p.name}
            </span>
          ))}
        </div>
        <span className="font-mono font-bold mb-[0.5vh]" style={{ fontSize: scoreSize, color }}>
          {group.score} pts
        </span>
        <div
          style={{
            width,
            height: podiumHeights[t],
            background: `linear-gradient(180deg, rgba(${rgb},0.3) 0%, rgba(${rgb},0.05) 100%)`,
            border: `1px solid rgba(${rgb},0.4)`,
            borderRadius: '0.3vw 0.3vw 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="font-bold" style={{ fontSize: labelSize, color }}>
            {ordinal(group.rank)}
          </span>
        </div>
      </div>
    );
  };

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
          <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
            <div
              ref={listRef}
              className="absolute top-0 left-0 flex gap-[1vw]"
              style={{
                transform: `scale(${fitScale})`,
                transformOrigin: 'top left',
                width: `${100 / fitScale}%`,
              }}
            >
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-[0.3vw]">
              {col.map(({ player, rank, tier, revealIndex }) => {
              const isVisible = revealIndex < visibleCount;
              const isPodium = tier < 3;

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
                    background: isPodium
                      ? `rgba(${podiumRgb[tier]}, 0.08)`
                      : 'rgba(255,255,255,0.02)',
                    border: isPodium
                      ? `1px solid rgba(${podiumRgb[tier]}, 0.2)`
                      : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Rank */}
                  <span
                    className="font-bold shrink-0 text-right"
                    style={{
                      fontSize: '1.2vw',
                      width: '2.5vw',
                      color: isPodium
                        ? podiumColors[tier]
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
                      color: isPodium ? '#fff' : 'rgba(255,255,255,0.6)',
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
                      color: isPodium ? podiumColors[tier] : 'rgba(255,255,255,0.5)',
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
            ))}
            </div>
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

          {/* Podium — tied players share a step (see renderPodiumStep) */}
          {showPodium && podiumGroups.length >= 1 && (
            <div className="flex items-end gap-[1vw]">
              {/* 2nd tier (left) */}
              {renderPodiumStep(1, { width: '8vw', nameSize: '1.3vw', scoreSize: '1.5vw', labelSize: '2vw', animDelay: '0.2s' })}
              {/* 1st tier (center, tallest) */}
              {renderPodiumStep(0, { width: '10vw', nameSize: '1.6vw', scoreSize: '1.8vw', labelSize: '2.5vw', animDelay: '0.5s' })}
              {/* 3rd tier (right) */}
              {renderPodiumStep(2, { width: '7vw', nameSize: '1.2vw', scoreSize: '1.3vw', labelSize: '1.8vw', animDelay: '0.1s' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
