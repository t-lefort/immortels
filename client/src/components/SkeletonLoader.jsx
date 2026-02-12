/**
 * SkeletonLoader — Animated placeholder for loading content.
 * Displays pulsing gray bars that indicate content is being loaded.
 *
 * Props:
 *   lines: number — number of skeleton lines to render (default: 3)
 *   className: string — additional classes for the container
 */
export default function SkeletonLoader({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={getLineWidth(i, lines)} />
      ))}
    </div>
  );
}

function SkeletonLine({ width }) {
  return (
    <div
      className="h-4 rounded bg-gray-800 animate-pulse"
      style={{ width }}
    />
  );
}

/**
 * SkeletonCard — Card-shaped skeleton for larger loading areas.
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-lg bg-gray-900 border border-gray-800 p-4 space-y-3 ${className}`}>
      <div className="h-5 w-2/5 rounded bg-gray-800 animate-pulse" />
      <div className="h-4 w-full rounded bg-gray-800 animate-pulse" />
      <div className="h-4 w-3/4 rounded bg-gray-800 animate-pulse" />
      <div className="h-10 w-1/3 rounded bg-gray-800 animate-pulse mt-4" />
    </div>
  );
}

/**
 * SkeletonAvatar — Circle skeleton for avatar/profile loading.
 */
export function SkeletonAvatar({ size = 40, className = '' }) {
  return (
    <div
      className={`rounded-full bg-gray-800 animate-pulse flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Vary line widths for a more natural look.
 */
function getLineWidth(index, total) {
  const widths = ['100%', '85%', '70%', '90%', '60%', '75%', '95%', '80%'];
  return widths[index % widths.length];
}
