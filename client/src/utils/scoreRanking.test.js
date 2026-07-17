import test from 'node:test';
import assert from 'node:assert/strict';
import { rankScoreboard } from './scoreRanking.js';

test('equal scores share a competition rank', () => {
  const ranked = rankScoreboard([
    { id: 1, score: 10 },
    { id: 2, score: 10 },
    { id: 3, score: 8 },
  ]);

  assert.deepEqual(ranked.map(player => player.rank), [1, 1, 3]);
  assert.deepEqual(ranked.map(player => player.tier), [0, 0, 1]);
});
