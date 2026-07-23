/**
 * Banner + switch controlling the admin incognito mode.
 * Rendered at the top of every admin tab that can display roles.
 */
export default function IncognitoToggle({ incognito, onToggle }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border text-sm ${
      incognito
        ? 'bg-gray-900 border-gray-700 text-gray-300'
        : 'bg-red-950/40 border-red-900/60 text-red-200'
    }`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{incognito ? '🙈' : '👁️'}</span>
        <span>
          {incognito
            ? 'Mode incognito actif — les rôles sont masqués.'
            : 'Rôles visibles — attention aux regards indiscrets.'}
        </span>
      </div>
      <button
        onClick={onToggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
          incognito
            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600'
            : 'bg-red-900 text-white hover:bg-red-800 border border-red-700'
        }`}
      >
        {incognito ? 'Afficher les rôles' : 'Masquer les rôles'}
      </button>
    </div>
  );
}

/**
 * A role value hidden behind incognito mode. Click to peek at a single row
 * without turning the whole screen back on.
 */
export function HiddenRole({ children, incognito, peeked, onPeek, className = '' }) {
  if (!incognito || peeked) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      onClick={onPeek}
      title="Cliquer pour révéler"
      className={`px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-600 border border-gray-700 hover:text-gray-400 tracking-widest ${className}`}
    >
      ••••
    </button>
  );
}
