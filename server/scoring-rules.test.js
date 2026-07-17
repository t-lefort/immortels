import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGhostIdentificationDelta,
  getWinningFactionDelta,
  validateGhostIdentificationTargets,
} from './scoring-rules.js';

test('a villager ghost may identify one or two distinct players', () => {
  assert.deepEqual(validateGhostIdentificationTargets(['1']), [1]);
  assert.deepEqual(validateGhostIdentificationTargets([1, 2]), [1, 2]);
});

test('ghost identification rejects empty, duplicate, and oversized selections', () => {
  assert.throws(() => validateGhostIdentificationTargets([]));
  assert.throws(() => validateGhostIdentificationTargets([1, 1]));
  assert.throws(() => validateGhostIdentificationTargets([1, 2, 3]));
});

test('ghost identification uses the +2/-1 scoring rule', () => {
  assert.equal(getGhostIdentificationDelta(true), 2);
  assert.equal(getGhostIdentificationDelta(false), -1);

  assert.equal([true, true].reduce((score, result) => score + getGhostIdentificationDelta(result), 0), 4);
  assert.equal([true, false].reduce((score, result) => score + getGhostIdentificationDelta(result), 0), 1);
  assert.equal([false, false].reduce((score, result) => score + getGhostIdentificationDelta(result), 0), -2);
});

test('all winners receive +2 and surviving winners receive +3 total', () => {
  assert.equal(getWinningFactionDelta('ghost'), 2);
  assert.equal(getWinningFactionDelta('alive'), 3);
});
