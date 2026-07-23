import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFakePack } from './fakePack.js';

/**
 * The decoy pack only works if it is indistinguishable from a real one.
 * Each test below pins one of the properties an observer could check.
 */

/** 14 players: ids 1..14, all alive and unrevealed unless overridden. */
function roster(overrides = {}) {
  return Array.from({ length: 14 }, (_, i) => {
    const id = i + 1;
    return { id, name: `Joueur ${String(id).padStart(2, '0')}`, status: 'alive', ...(overrides[id] || {}) };
  });
}

const WOLF_COUNT = 4;

test('decoy holds wolfCount - 1 names, like a real pack', () => {
  const pack = buildFakePack({ selfId: 1, players: roster(), wolfCount: WOLF_COUNT });
  assert.equal(pack.length, WOLF_COUNT - 1);
});

test('decoy never names the holder', () => {
  const players = roster();
  const pack = buildFakePack({ selfId: 7, players, wolfCount: WOLF_COUNT });
  const self = players.find(p => p.id === 7);
  assert.ok(!pack.includes(self.name));
});

test('decoy includes every publicly exposed wolf', () => {
  // Two wolves eliminated and revealed
  const players = roster({
    3: { status: 'ghost', role: 'wolf' },
    9: { status: 'ghost', role: 'wolf' },
  });
  const pack = buildFakePack({ selfId: 1, players, wolfCount: WOLF_COUNT });

  assert.ok(pack.includes('Joueur 03'), 'exposed wolf 3 must appear');
  assert.ok(pack.includes('Joueur 09'), 'exposed wolf 9 must appear');
  assert.equal(pack.length, WOLF_COUNT - 1);
});

test('decoy never names a player already cleared as a villager', () => {
  const cleared = { 2: { status: 'ghost', role: 'villager' }, 4: { status: 'ghost', role: 'villager' } };
  const players = roster(cleared);
  const pack = buildFakePack({ selfId: 1, players, wolfCount: WOLF_COUNT });

  assert.ok(!pack.includes('Joueur 02'));
  assert.ok(!pack.includes('Joueur 04'));
});

test('decoy is stable across repeated builds', () => {
  const first = buildFakePack({ selfId: 5, players: roster(), wolfCount: WOLF_COUNT });
  const second = buildFakePack({ selfId: 5, players: roster(), wolfCount: WOLF_COUNT });
  assert.deepEqual(first, second);
});

test('decoy is stable when an unrelated player is eliminated', () => {
  const before = buildFakePack({ selfId: 5, players: roster(), wolfCount: WOLF_COUNT });

  // Someone the decoy did not name gets revealed as a villager
  const untouched = roster().find(p => p.id !== 5 && !before.includes(p.name));
  const after = buildFakePack({
    selfId: 5,
    players: roster({ [untouched.id]: { status: 'ghost', role: 'villager' } }),
    wolfCount: WOLF_COUNT,
  });

  assert.deepEqual(after, before);
});

test('only the outed member is swapped when a decoy member is cleared', () => {
  const before = buildFakePack({ selfId: 5, players: roster(), wolfCount: WOLF_COUNT });
  const outedName = before[0];
  const outed = roster().find(p => p.name === outedName);

  const after = buildFakePack({
    selfId: 5,
    players: roster({ [outed.id]: { status: 'ghost', role: 'villager' } }),
    wolfCount: WOLF_COUNT,
  });

  assert.ok(!after.includes(outedName), 'cleared member must be dropped');
  assert.equal(after.length, before.length, 'pack keeps its size');
  const kept = before.filter(n => n !== outedName);
  for (const name of kept) {
    assert.ok(after.includes(name), `${name} should have kept its place`);
  }
});

test('different players get different decoys', () => {
  const a = buildFakePack({ selfId: 1, players: roster(), wolfCount: WOLF_COUNT });
  const b = buildFakePack({ selfId: 2, players: roster(), wolfCount: WOLF_COUNT });
  assert.notDeepEqual(a, b);
});

test('decoy is sorted like the real pack (BINARY collation)', () => {
  const pack = buildFakePack({ selfId: 1, players: roster(), wolfCount: 6 });
  const sorted = [...pack].sort((x, y) => (x === y ? 0 : x < y ? -1 : 1));
  assert.deepEqual(pack, sorted);
});

test('a lone wolf shows no pack, and so does the decoy', () => {
  assert.deepEqual(buildFakePack({ selfId: 1, players: roster(), wolfCount: 1 }), []);
});

test('decoy is empty before roles are assigned', () => {
  assert.deepEqual(buildFakePack({ selfId: 1, players: roster(), wolfCount: 0 }), []);
});

test('decoy shrinks gracefully when too few candidates remain', () => {
  // Almost everyone cleared: not enough unrevealed players left to fill it
  const overrides = {};
  for (let id = 2; id <= 13; id++) overrides[id] = { status: 'ghost', role: 'villager' };
  const pack = buildFakePack({ selfId: 1, players: roster(overrides), wolfCount: WOLF_COUNT });

  assert.ok(pack.length <= WOLF_COUNT - 1);
  assert.ok(!pack.includes('Joueur 02'));
});
