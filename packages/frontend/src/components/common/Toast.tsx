import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckIcon, XCircleIcon, InfoIcon, XIcon } from '../icons';

// Toast types
export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number | null; // null means persist until dismissed
  action?: ToastAction;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number | null;
  createdAt: number;
  action?: ToastAction;
}

export interface ToastContextValue {
  toasts: Toast[];
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Default durations
const DEFAULT_SUCCESS_DURATION = 3000;
const DEFAULT_INFO_DURATION = 3000;
const MAX_VISIBLE_TOASTS = 3;

/**
 * Toast Provider - wraps the app to provide toast notifications
 * Implements toast queue with max 3 visible, auto-dismiss for success,
 * and persistence for error toasts.
 */
export function ToastProvider({ 
  children,
  maxToasts = MAX_VISIBLE_TOASTS,
  position = 'bottom-right'
}: { 
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((options: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine duration based on type
    let duration: number | null;
    if (options.duration !== undefined) {
      duration = options.duration;
    } else if (options.type === 'error') {
      // Error toasts persist until dismissed
      duration = null;
    } else if (options.type === 'success') {
      duration = DEFAULT_SUCCESS_DURATION;
    } else {
      duration = DEFAULT_INFO_DURATION;
    }

    const newToast: Toast = {
      id,
      message: options.message,
      type: options.type,
      duration,
      createdAt: Date.now(),
      action: options.action,
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      // If we exceed max toasts, remove the oldest ones (FIFO)
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    return id;
  }, [maxToasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissAll }}>
      {children}
      <ToastContainer 
        toasts={toasts} 
        dismissToast={dismissToast} 
        position={position}
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications.
 * Throws if used outside ToastProvider.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if ToastProvider is not present.
 * Use this when toast notifications are optional (e.g., in SSE event handlers).
 */
export function useToastOptional() {
  return useContext(ToastContext);
}

// Legacy support - simple addToast function
export function useLegacyToast() {
  const { showToast, dismissToast } = useToast();
  
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    return showToast({ message, type });
  }, [showToast]);

  return { addToast, removeToast: dismissToast };
}

/**
 * Toast Container - displays all active toasts
 * Positioned in bottom-right corner, stacks vertically
 */
export function ToastContainer({ 
  toasts, 
  dismissToast,
  position = 'bottom-right'
}: { 
  toasts: Toast[]; 
  dismissToast: (id: string) => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}) {
  if (toasts.length === 0) return null;

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  }[position];

  const stackDirection = position.startsWith('top') ? 'flex-col' : 'flex-col-reverse';

  return (
    <div 
      className={`fixed ${positionClasses} z-toast flex ${stackDirection} gap-2 max-w-sm pointer-events-none`}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={() => dismissToast(toast.id)} 
        />
      ))}
    </div>
  );
}

/**
 * Individual Toast Item - paper-clean styling with animations
 */
export function ToastItem({ 
  toast, 
  onDismiss 
}: { 
  toast: Toast; 
  onDismiss: () => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    // Only auto-dismiss if duration is set (not null)
    if (toast.duration !== null) {
      timerRef.current = setTimeout(handleDismiss, toast.duration);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [toast.duration, handleDismiss]);

  // Paper-clean styling with warm off-white background
  const typeStyles = {
    success: 'bg-paper border-support/30 text-ink',
    error: 'bg-paper border-oppose/30 text-ink',
    info: 'bg-paper border-accent/30 text-ink',
  }[toast.type];

  const iconStyles = {
    success: 'text-support',
    error: 'text-oppose',
    info: 'text-accent',
  }[toast.type];

  const icon = {
    success: (
      <CheckIcon size="md" className="animate-in zoom-in duration-300" decorative />
    ),
    error: (
      <XCircleIcon size="md" className="animate-in zoom-in duration-300" decorative />
    ),
    info: (
      <InfoIcon size="md" className="animate-in zoom-in duration-300" decorative />
    ),
  }[toast.type];

  const animationClass = isExiting
    ? 'animate-out slide-out-to-right-5 fade-out duration-200'
    : 'animate-in slide-in-from-right-5 fade-in duration-200';

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-toast
        pointer-events-auto
        ${typeStyles}
        ${animationClass}
      `}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className={`flex-shrink-0 mt-0.5 ${iconStyles}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {/* Dismiss button - 44px minimum touch target for accessibility (Requirement 8.4) */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink/40 hover:text-ink/70 transition-colors -mr-2 -mt-1"
        aria-label="Dismiss notification"
      >
        <XIcon size="sm" decorative />
      </button>
    </div>
  );
}

export default ToastProvider;
