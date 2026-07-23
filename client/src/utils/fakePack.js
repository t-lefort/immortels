/**
 * Builds the decoy wolf pack shown on a faked "Loup" role card.
 *
 * Without it the fake card would be self-defeating: a real wolf card always
 * lists a pack, so showing a Loup card with no pack would prove the holder is
 * a villager — the exact accusation the fake card exists to defuse.
 *
 * A random draw is not enough either. A real pack has properties an observer
 * can check, and the decoy has to satisfy all of them:
 *
 *  1. **Right size.** A real pack lists every wolf of the game minus oneself,
 *     dead ones included, so the decoy holds `wolfCount - 1` names.
 *  2. **Contains every wolf already exposed.** Eliminated players have their
 *     role revealed, and a real pack necessarily includes them. A decoy that
 *     omitted a publicly known wolf would stand out immediately.
 *  3. **Contains nobody already cleared.** For the same reason, a decoy must
 *     never name a player publicly revealed as a villager.
 *  4. **Stable.** A real pack never changes. The decoy is derived from a hash
 *     of (holder, candidate) rather than drawn at random, so it comes out
 *     identical on every render, every reload and every device — two people
 *     comparing screenshots taken hours apart see the same names.
 *
 * The one thing it cannot promise is immutability across a whole game: when a
 * decoy member is later revealed as a villager, rule 3 forces a replacement.
 * That is the minimum possible churn — every other name keeps its place.
 *
 * Nothing here is persisted or sent to the server; the decoy exists only for
 * as long as the card is on screen.
 */

/**
 * FNV-1a, folded to a float in [0, 1). Deterministic across engines and
 * platforms, which is what stability depends on.
 */
function hashToUnit(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in range via Math.imul
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

/**
 * Order names the way SQLite's default BINARY collation does, so the decoy is
 * sorted exactly like the real list (which arrives `ORDER BY name`).
 */
function byCodeUnit(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * @param {object}   params
 * @param {number}   params.selfId    holder of the card
 * @param {Array}    params.players   full roster ({ id, name, status, role? })
 * @param {number}   params.wolfCount total wolves in the game
 * @returns {string[]} pack member names, ordered like the real thing
 */
export function buildFakePack({ selfId, players, wolfCount }) {
  const packSize = (wolfCount || 0) - 1;
  if (packSize <= 0 || !Array.isArray(players)) return [];

  const others = players.filter(p => p.id !== selfId);

  // Roles are only public for eliminated players
  const exposedWolves = others.filter(p => p.status === 'ghost' && p.role === 'wolf');
  const clearedIds = new Set(
    others.filter(p => p.status === 'ghost' && p.role === 'villager').map(p => p.id)
  );
  const exposedIds = new Set(exposedWolves.map(p => p.id));

  // Everyone whose role is still unknown to the village
  const candidates = others.filter(p => !clearedIds.has(p.id) && !exposedIds.has(p.id));

  const remainingSlots = Math.max(0, packSize - exposedWolves.length);
  const filler = candidates
    .map(p => ({ player: p, key: hashToUnit(`${selfId}:${p.id}`) }))
    .sort((a, b) => a.key - b.key || a.player.id - b.player.id)
    .slice(0, remainingSlots)
    .map(entry => entry.player);

  return [...exposedWolves, ...filler]
    .map(p => p.name)
    .sort(byCodeUnit);
}
