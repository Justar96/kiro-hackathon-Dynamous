import { useSSEContext } from '../lib';

/**
 * ConnectionStatus Component
 * 
 * Shows a subtle indicator when the SSE connection is disconnected or in error state.
 * Hidden when connected to avoid visual noise.
 * 
 * Requirements: 9.6
 */
export function ConnectionStatus() {
  const sseContext = useSSEContext();
  
  // Don't render anything if no SSE context or if connected
  if (!sseContext || sseContext.isConnected) {
    return null;
  }
  
  const { connectionStatus } = sseContext;
  
  // Only show indicator for disconnected or error states
  if (connectionStatus === 'connected') {
    return null;
  }
  
  const statusConfig = {
    connecting: {
      text: 'Connecting...',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
    },
    disconnected: {
      text: 'Disconnected',
      bgColor: 'bg-stone-50',
      textColor: 'text-stone-600',
      borderColor: 'border-stone-200',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
      ),
    },
    error: {
      text: 'Connection lost. Reconnecting...',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  };
  
  const config = statusConfig[connectionStatus];
  
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
    </div>
  );
}

export interface ConnectionStatusProps {
  // No props needed - uses context
}
