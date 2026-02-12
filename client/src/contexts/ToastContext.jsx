import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

/**
 * Toast notification provider.
 * Types: 'success' (green), 'error' (red), 'info' (blue).
 * Auto-dismiss after 3 seconds.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);

    // Auto-dismiss after 3s
    timersRef.current[id] = setTimeout(() => {
      // Start exit animation
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      // Remove after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        delete timersRef.current[id];
      }, 300);
    }, 3000);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const bgColor = {
    success: 'bg-green-800/95 border-green-600',
    error: 'bg-red-800/95 border-red-600',
    info: 'bg-blue-800/95 border-blue-600',
  }[toast.type] || 'bg-gray-800/95 border-gray-600';

  return (
    <div
      className={`
        pointer-events-auto mt-2 mx-4 px-4 py-2.5 rounded-lg border backdrop-blur-sm
        shadow-lg text-white text-sm font-medium max-w-sm w-full
        transition-all duration-300 ease-out
        ${bgColor}
        ${toast.exiting
          ? 'opacity-0 -translate-y-2'
          : 'opacity-100 translate-y-0 animate-slideDown'
        }
      `}
      onClick={() => onRemove(toast.id)}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
          className="text-white/60 hover:text-white flex-shrink-0"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
