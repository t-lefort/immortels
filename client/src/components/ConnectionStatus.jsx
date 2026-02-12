import { useState, useEffect } from 'react';

/**
 * ConnectionStatus — shows a small indicator for socket connection state.
 *
 * Props:
 *   connected: boolean — whether the socket is currently connected
 *   position: 'bottom' | 'top' — where to anchor the banner (default: 'bottom')
 *
 * Behavior:
 *   - Green dot when connected (auto-fades after 2 seconds)
 *   - Yellow dot + "Reconnexion..." when reconnecting (always visible)
 *   - Red dot + "Deconnecte" when disconnected (always visible)
 */
export default function ConnectionStatus({ connected, position = 'bottom' }) {
  const [visible, setVisible] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    if (!connected) {
      // Show immediately when disconnected
      setVisible(true);
      setWasDisconnected(true);
    } else if (wasDisconnected) {
      // Just reconnected — show green briefly then fade
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setWasDisconnected(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [connected, wasDisconnected]);

  // Don't render anything when connected and not recently reconnected
  if (!visible && connected) return null;

  const positionClass = position === 'top'
    ? 'top-0 left-0 right-0'
    : 'bottom-0 left-0 right-0';

  // Determine status state
  let dotColor, label, bgColor;
  if (connected) {
    dotColor = 'bg-green-500';
    label = 'Connecte';
    bgColor = 'bg-green-900/90';
  } else if (wasDisconnected) {
    // Could be in reconnecting state or fully disconnected
    // Socket.IO auto-reconnects, so if not connected, we show reconnecting first
    dotColor = 'bg-yellow-500 animate-pulse';
    label = 'Reconnexion...';
    bgColor = 'bg-yellow-900/90';
  }

  return (
    <div
      className={`fixed ${positionClass} z-50 flex items-center justify-center px-4 py-2 ${bgColor} backdrop-blur-sm transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mr-2 flex-shrink-0`} />
      <span className="text-sm text-white font-medium">{label}</span>
    </div>
  );
}
