/**
 * ContextualHelpTooltip provides contextual help tooltips explaining debate phases.
 * Shows for new users (first 5 debates) and can be dismissed.
 * 
 * Requirements: 5.5 - Contextual help tooltips explaining each phase for new users
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ContextualHelpTooltipProps {
  /** The phase/context to show help for */
  phase: 'opening' | 'rebuttal' | 'closing' | 'waiting' | 'your-turn' | 'concluded';
  /** Whether the user is a new user (first 5 debates) */
  isNewUser?: boolean;
  /** Number of debates the user has participated in */
  debatesParticipated?: number;
  /** Whether to force show the tooltip regardless of user status */
  forceShow?: boolean;
  /** Callback when tooltip is dismissed */
  onDismiss?: () => void;
  /** Position of the tooltip relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Children to wrap with tooltip trigger */
  children: React.ReactNode;
}

export interface PhaseHelpContent {
  title: string;
  description: string;
  tip?: string;
}

const NEW_USER_THRESHOLD = 5;

/**
 * Gets the help content for a specific phase.
 */
export function getPhaseHelpContent(phase: ContextualHelpTooltipProps['phase']): PhaseHelpContent {
  switch (phase) {
    case 'opening':
      return {
        title: 'Opening Round',
        description: 'Each debater presents their initial position and key arguments. This is your chance to make a strong first impression.',
        tip: 'Focus on your strongest points and establish your core thesis.',
      };
    case 'rebuttal':
      return {
        title: 'Rebuttal Round',
        description: 'Respond to your opponent\'s arguments. Address their key points and strengthen your position.',
        tip: 'Before submitting, you must demonstrate understanding of your opponent\'s position (Steelman Gate).',
      };
    case 'closing':
      return {
        title: 'Closing Round',
        description: 'Summarize your case and make final appeals. This is your last chance to persuade the audience.',
        tip: 'Highlight the strongest points from the debate and address any remaining concerns.',
      };
    case 'waiting':
      return {
        title: 'Waiting for Opponent',
        description: 'Your debate is in the queue waiting for an opponent to join. Once matched, the debate will begin.',
        tip: 'You can browse other debates while waiting.',
      };
    case 'your-turn':
      return {
        title: 'Your Turn!',
        description: 'It\'s your turn to submit an argument. Take your time to craft a thoughtful response.',
        tip: 'Quality matters more than speed. Well-reasoned arguments have more impact.',
      };
    case 'concluded':
      return {
        title: 'Debate Concluded',
        description: 'This debate has ended. Review the results to see how the audience was persuaded.',
        tip: 'Check the persuasion delta to see which arguments had the most impact.',
      };
    default:
      return {
        title: 'Help',
        description: 'Learn more about this feature.',
      };
  }
}

/**
 * Determines if help should be shown based on user status.
 */
export function shouldShowHelp(
  debatesParticipated: number = 0,
  forceShow: boolean = false,
  dismissed: boolean = false
): boolean {
  if (dismissed) return false;
  if (forceShow) return true;
  return debatesParticipated < NEW_USER_THRESHOLD;
}

/**
 * Storage key for dismissed tooltips.
 */
const DISMISSED_TOOLTIPS_KEY = 'thesis-dismissed-tooltips';

/**
 * Gets dismissed tooltips from localStorage.
 */
function getDismissedTooltips(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_TOOLTIPS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore localStorage errors
  }
  return new Set();
}

/**
 * Saves dismissed tooltip to localStorage.
 */
function saveDismissedTooltip(phase: string): void {
  try {
    const dismissed = getDismissedTooltips();
    dismissed.add(phase);
    localStorage.setItem(DISMISSED_TOOLTIPS_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Ignore localStorage errors
  }
}

export function ContextualHelpTooltip({
  phase,
  isNewUser,
  debatesParticipated = 0,
  forceShow = false,
  onDismiss,
  position = 'bottom',
  children,
}: ContextualHelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  // Check if this tooltip was previously dismissed
  useEffect(() => {
    const dismissed = getDismissedTooltips();
    if (dismissed.has(phase)) {
      setIsDismissed(true);
    }
  }, [phase]);
  
  // Determine if we should show help
  const effectiveIsNewUser = isNewUser ?? debatesParticipated < NEW_USER_THRESHOLD;
  const showHelp = shouldShowHelp(debatesParticipated, forceShow, isDismissed) && effectiveIsNewUser;
  
  // Auto-show tooltip for new users on mount
  useEffect(() => {
    if (showHelp && !isDismissed) {
      // Delay showing to avoid flash
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showHelp, isDismissed]);
  
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setIsDismissed(true);
    saveDismissedTooltip(phase);
    onDismiss?.();
  }, [phase, onDismiss]);
  
  const handleToggle = useCallback(() => {
    if (!isDismissed || forceShow) {
      setIsVisible(prev => !prev);
    }
  }, [isDismissed, forceShow]);
  
  // Close on click outside
  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);
  
  const content = getPhaseHelpContent(phase);
  const positionClasses = getPositionClasses(position);
  
  return (
    <div className="relative inline-block" ref={triggerRef}>
      {/* Trigger wrapper */}
      <div 
        className="inline-flex items-center gap-1 cursor-help"
        onClick={handleToggle}
        onKeyDown={(e) => e.key === 'Enter' && handleToggle()}
        tabIndex={0}
        role="button"
        aria-expanded={isVisible}
        aria-describedby={isVisible ? `tooltip-${phase}` : undefined}
      >
        {children}
        
        {/* Help indicator for new users */}
        {showHelp && !isDismissed && (
          <span 
            className="inline-flex items-center justify-center w-4 h-4 text-xs bg-accent/10 text-accent rounded-full animate-pulse"
            aria-hidden="true"
          >
            ?
          </span>
        )}
      </div>
      
      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={`tooltip-${phase}`}
          role="tooltip"
          className={`
            absolute z-50 w-72 p-4 bg-white border border-gray-200 rounded-lg shadow-elevated
            ${positionClasses}
          `}
          data-testid={`help-tooltip-${phase}`}
        >
          {/* Arrow */}
          <div className={`absolute w-3 h-3 bg-white border-gray-200 transform rotate-45 ${getArrowClasses(position)}`} />
          
          {/* Content */}
          <div className="relative">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-text-primary text-sm">
                {content.title}
              </h4>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-text-tertiary hover:text-text-secondary p-0.5 -mr-1 -mt-1"
                aria-label="Dismiss help"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-text-secondary text-sm mb-2">
              {content.description}
            </p>
            
            {content.tip && (
              <div className="flex items-start gap-2 p-2 bg-accent/5 rounded text-xs">
                <LightbulbIcon className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <span className="text-text-secondary">{content.tip}</span>
              </div>
            )}
            
            {/* Don't show again option */}
            <button
              type="button"
              onClick={handleDismiss}
              className="mt-3 text-xs text-text-tertiary hover:text-text-secondary underline"
            >
              Don't show this again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getPositionClasses(position: ContextualHelpTooltipProps['position']): string {
  switch (position) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2';
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2';
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2';
    default:
      return 'top-full left-1/2 -translate-x-1/2 mt-2';
  }
}

function getArrowClasses(position: ContextualHelpTooltipProps['position']): string {
  switch (position) {
    case 'top':
      return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r';
    case 'bottom':
      return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l';
    case 'left':
      return 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t border-r';
    case 'right':
      return 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-b border-l';
    default:
      return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l';
  }
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

export default ContextualHelpTooltip;
