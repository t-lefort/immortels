/**
 * Apply competition ranking to a scoreboard already sorted by descending score.
 * Equal scores share a rank and the following rank is skipped (1, 1, 3).
 */
export function rankScoreboard(scoreboard = []) {
  let rank = 0;
  let tier = -1;
  let previousScore = null;

  return scoreboard.map((player, index) => {
    if (index === 0 || player.score !== previousScore) {
      rank = index + 1;
      tier += 1;
      previousScore = player.score;
    }
    return { ...player, rank, tier };
  });
}
