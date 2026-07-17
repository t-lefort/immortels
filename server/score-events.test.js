import test from 'node:test';
import assert from 'node:assert/strict';
import { recordScoreEvent } from './score-events.js';

test('score event records the before and after scores', () => {
  let insertedValues = null;
  const fakeDb = {
    prepare(sql) {
      if (sql.includes('FROM players WHERE id')) {
        return { get: () => ({ name: 'Bob', role: 'villager', status: 'ghost', score: 9 }) };
      }
      if (sql.includes('INSERT INTO score_events')) {
        return {
          run: (...values) => {
            insertedValues = values;
            return { lastInsertRowid: 42 };
          },
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const event = recordScoreEvent({
    playerId: 7,
    phaseId: 3,
    sourceType: 'phase',
    sourceId: 3,
    reason: 'ghost_identified_wolf',
    delta: 2,
    metadata: { targetName: 'Alice' },
  }, fakeDb);

  assert.equal(event.id, 42);
  assert.equal(event.scoreBefore, 7);
  assert.equal(event.scoreAfter, 9);
  assert.deepEqual(insertedValues.slice(0, 8), [7, 3, 'phase', '3', 'ghost_identified_wolf', 2, 7, 9]);
});
