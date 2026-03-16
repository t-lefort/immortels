// Map special_role keys to French display labels (excluding maire)
const SPECIAL_ROLE_LABELS = {
  sorciere: 'Sorciere',
  protecteur: 'Protecteur',
  voyante: 'Voyante',
  chasseur: 'Chasseur',
  immunite: 'Immunite',
};

/** Parse comma-separated special_role into array */
function parseRoles(str) {
  if (!str) return [];
  return str.split(',').map(r => r.trim()).filter(Boolean);
}

/** Check if special_role string contains a given role */
function hasRole(str, role) {
  return parseRoles(str).includes(role);
}

/**
 * Format a ghost player's badge label with their former role.
 * e.g. "Fantome (Villageois)" or "Fantome (Loup, Voyante)"
 */
function formatGhostLabel(player) {
  if (!player.role) return 'Fantome';
  const roleName = player.role === 'wolf' ? 'Loup' : 'Villageois';
  const roles = parseRoles(player.special_role).filter(r => r !== 'maire');
  const specialLabels = roles.map(r => SPECIAL_ROLE_LABELS[r]).filter(Boolean);
  const parts = specialLabels.length > 0 ? `${roleName}, ${specialLabels.join(', ')}` : roleName;
  return `Fantome (${parts})`;
}

/**
 * Reusable player display card.
 * Shows name, status indicator, selectable state for voting.
 */
export default function PlayerCard({
  player,
  selected = false,
  disabled = false,
  onClick,
  showStatus = true,
  compact = false,
}) {
  const isGhost = player.status === 'ghost';
  const hasImmunity = hasRole(player.special_role, 'immunite');

  function handleClick() {
    if (!disabled && onClick) {
      onClick(player);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        w-full text-left rounded-lg border transition-all
        ${compact ? 'p-3' : 'p-4'}
        min-h-[48px] touch-manipulation
        ${disabled
          ? 'opacity-50 cursor-not-allowed border-gray-800 bg-gray-900/30'
          : selected
            ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/10'
            : 'border-gray-700 bg-gray-800/50 active:bg-gray-700/70 active:border-gray-500'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Selection indicator */}
          <div
            className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
              ${selected
                ? 'border-yellow-500 bg-yellow-500'
                : 'border-gray-600 bg-transparent'
              }
            `}
          >
            {selected && (
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>

          {/* Player name */}
          <span className={`font-medium ${compact ? 'text-base' : 'text-lg'} text-white`}>
            {player.name}
          </span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {hasImmunity && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-800">
              Immunité
            </span>
          )}
          {showStatus && isGhost && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-ghost/20 text-green-400 border border-ghost/40">
              {formatGhostLabel(player)}
            </span>
          )}
          {showStatus && !isGhost && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}
