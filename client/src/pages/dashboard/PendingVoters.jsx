/**
 * Names of the players who still have to vote, for the projected screen.
 *
 * The counter alone ("22 / 29") makes the room hunt for the missing seven; the
 * names turn that into a glance. Nothing here depends on a role: the night list
 * is built from the combined wolf + villager counter, so wolves and villagers
 * are indistinguishable in it.
 */
export default function PendingVoters({ pending, accent = '#6a7fdb' }) {
  if (!pending || pending.length === 0) {
    return (
      <p
        className="text-center font-medium"
        style={{ fontSize: '1.2vw', color: 'rgba(120, 220, 150, 0.9)' }}
      >
        Tout le monde a voté
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-[1vh]">
      <span
        className="uppercase tracking-[0.25em]"
        style={{ fontSize: '0.9vw', color: 'rgba(255,255,255,0.35)' }}
      >
        En attente de
      </span>
      <div className="flex flex-wrap justify-center gap-[0.6vw]">
        {pending.map(p => (
          <span
            key={p.id}
            style={{
              fontSize: '1.1vw',
              padding: '0.3vh 0.8vw',
              borderRadius: '0.3vw',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${accent}55`,
            }}
          >
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
