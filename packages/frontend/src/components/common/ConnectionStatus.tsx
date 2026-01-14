import { useSSEContext } from '../../lib';
import { SpinnerIcon, WarningIcon, XCircleIcon } from '../icons';

/**
 * ConnectionStatus Component
 * 
 * Shows a subtle indicator when the SSE connection is disconnected or in error state.
 * Hidden when connected to avoid visual noise.
 * Includes retry button for circuit-breaker state.
 * 
 * Requirements: 8.2, 9.6, 12.4
 */
export function ConnectionStatus() {
  const sseContext = useSSEContext();
  
  // Don't render anything if no SSE context or if connected
  if (!sseContext || sseContext.isConnected) {
    return null;
  }
  
  const { connectionStatus, reconnect, errorCount } = sseContext;
  
  // Only show indicator for disconnected or error states
  if (connectionStatus === 'connected') {
    return null;
  }
  
  const statusConfig: Record<string, {
    text: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
    showRetry?: boolean;
  }> = {
    connecting: {
      text: 'Connecting...',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
      icon: <SpinnerIcon size="sm" className="animate-spin" decorative />,
    },
    disconnected: {
      text: 'Disconnected',
      bgColor: 'bg-stone-50',
      textColor: 'text-stone-600',
      borderColor: 'border-stone-200',
      icon: <XCircleIcon size="sm" decorative />,
    },
    error: {
      text: `Connection lost${errorCount > 1 ? ` (${errorCount} errors)` : ''}. Reconnecting...`,
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      icon: <WarningIcon size="sm" decorative />,
    },
    'circuit-breaker': {
      text: 'Connection paused due to repeated errors',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
      showRetry: true,
      icon: <WarningIcon size="sm" decorative />,
    },
  };
  
  const config = statusConfig[connectionStatus] || statusConfig.error;
  
  return (
    <div 
      className={`
        fixed bottom-4 left-4 z-40
        flex items-center gap-2 px-3 py-2
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        border rounded-lg shadow-sm
        text-sm font-medium
        transition-all duration-300 ease-in-out
        animate-fade-in
      `}
      role="status"
      aria-live="polite"
    >
      {config.icon}
      <span>{config.text}</span>
      {config.showRetry && (
        <button
          onClick={reconnect}
          className="ml-2 px-2 py-1 bg-orange-100 hover:bg-orange-200 rounded text-xs font-semibold transition-colors"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export interface ConnectionStatusProps {
  // No props needed - uses context
}
