/**
 * WaitingStateDisplay shows the waiting state for debates seeking opponents.
 * Displays estimated wait time and matching status.
 * 
 * Requirements: 5.6 - Show estimated wait time and matching status while waiting
 */

import { useState, useEffect, useMemo } from 'react';
import type { Debate, User } from '@thesis/shared';

export interface WaitingStateDisplayProps {
  /** The debate waiting for an opponent */
  debate: Debate;
  /** The creator of the debate */
  creator?: User | null;
  /** Number of debates currently in the queue */
  queueSize?: number;
  /** Average wait time in minutes (from backend stats) */
  averageWaitMinutes?: number;
  /** Whether matching is actively in progress */
  isMatching?: boolean;
  /** Callback when user wants to cancel waiting */
  onCancel?: () => void;
}

export interface WaitTimeEstimate {
  minMinutes: number;
  maxMinutes: number;
  displayText: string;
}

/**
 * Calculates estimated wait time based on queue position and average wait.
 */
export function calculateWaitEstimate(
  queueSize: number = 0,
  averageWaitMinutes: number = 5,
  createdAt: Date
): WaitTimeEstimate {
  const elapsedMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  
  // Base estimate on queue size and average wait
  const baseEstimate = Math.max(1, averageWaitMinutes - elapsedMinutes);
  const queueFactor = Math.max(1, queueSize * 0.5);
  
  const minMinutes = Math.max(1, Math.floor(baseEstimate / queueFactor));
  const maxMinutes = Math.max(minMinutes + 1, Math.ceil(baseEstimate * 1.5));
  
  let displayText: string;
  if (minMinutes < 1) {
    displayText = 'Any moment now';
  } else if (minMinutes === maxMinutes) {
    displayText = `~${minMinutes} min`;
  } else if (maxMinutes <= 5) {
    displayText = `${minMinutes}-${maxMinutes} min`;
  } else if (maxMinutes <= 15) {
    displayText = `${minMinutes}-${maxMinutes} min`;
  } else {
    displayText = '15+ min';
  }
  
  return { minMinutes, maxMinutes, displayText };
}

/**
 * Gets the matching status message based on current state.
 */
export function getMatchingStatusMessage(
  isMatching: boolean,
  queueSize: number,
  elapsedMinutes: number
): string {
  if (isMatching) {
    return 'Actively searching for a match...';
  }
  
  if (queueSize > 5) {
    return `${queueSize} debates in queue · High activity`;
  }
  
  if (queueSize > 0) {
    return `${queueSize} debate${queueSize === 1 ? '' : 's'} in queue`;
  }
  
  if (elapsedMinutes > 10) {
    return 'Waiting for opponents to join the platform';
  }
  
  return 'Looking for an opponent with similar interests';
}

export function WaitingStateDisplay({
  debate,
  queueSize = 0,
  averageWaitMinutes = 5,
  isMatching = false,
  onCancel,
}: WaitingStateDisplayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Update elapsed time every second
  useEffect(() => {
    const startTime = new Date(debate.createdAt).getTime();
    
    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    
    return () => clearInterval(interval);
  }, [debate.createdAt]);
  
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  
  const waitEstimate = useMemo(
    () => calculateWaitEstimate(queueSize, averageWaitMinutes, debate.createdAt),
    [queueSize, averageWaitMinutes, debate.createdAt]
  );
  
  const statusMessage = useMemo(
    () => getMatchingStatusMessage(isMatching, queueSize, elapsedMinutes),
    [isMatching, queueSize, elapsedMinutes]
  );
  
  const formattedElapsed = formatElapsedTime(elapsedSeconds);
  
  return (
    <div 
      className="waiting-state-display bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6"
      data-testid="waiting-state-display"
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <SearchIcon className="w-6 h-6 text-amber-600" />
          </div>
          {/* Animated ring */}
          <div className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-30" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-800">
            Seeking Opponent
          </h3>
          <p className="text-sm text-amber-600">
            {statusMessage}
          </p>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatBox
          label="Time Waiting"
          value={formattedElapsed}
          testId="elapsed-time"
        />
        <StatBox
          label="Est. Wait"
          value={waitEstimate.displayText}
          testId="estimated-wait"
        />
      </div>
      
      {/* Progress Indicator */}
      <div className="mb-4">
        <MatchingProgress 
          isMatching={isMatching} 
          elapsedMinutes={elapsedMinutes}
        />
      </div>
      
      {/* Tips */}
      <div className="bg-white/50 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-700 flex items-start gap-2">
          <LightbulbIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            While you wait, you can browse other debates or check out trending topics. 
            You'll be notified when an opponent joins.
          </span>
        </p>
      </div>
      
      {/* Actions */}
      {onCancel && (
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-amber-600 hover:text-amber-800 underline underline-offset-2"
          >
            Cancel and leave queue
          </button>
        </div>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  testId: string;
}

function StatBox({ label, value, testId }: StatBoxProps) {
  return (
    <div 
      className="text-center p-3 bg-white/60 rounded-lg"
      data-testid={testId}
    >
      <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-amber-800">
        {value}
      </p>
    </div>
  );
}

interface MatchingProgressProps {
  isMatching: boolean;
  elapsedMinutes: number;
}

function MatchingProgress({ isMatching, elapsedMinutes }: MatchingProgressProps) {
  // Progress stages
  const stages = [
    { label: 'Queued', complete: true },
    { label: 'Searching', complete: elapsedMinutes >= 1 || isMatching },
    { label: 'Matching', complete: isMatching },
    { label: 'Ready', complete: false },
  ];
  
  return (
    <div className="flex items-center justify-between" data-testid="matching-progress">
      {stages.map((stage, index) => (
        <div key={stage.label} className="flex items-center">
          {/* Stage dot */}
          <div className="flex flex-col items-center">
            <div 
              className={`
                w-3 h-3 rounded-full transition-colors
                ${stage.complete 
                  ? 'bg-amber-500' 
                  : index === stages.findIndex(s => !s.complete)
                    ? 'bg-amber-300 animate-pulse'
                    : 'bg-amber-200'
                }
              `}
            />
            <span className="text-xs text-amber-600 mt-1">
              {stage.label}
            </span>
          </div>
          
          {/* Connector line */}
          {index < stages.length - 1 && (
            <div 
              className={`
                w-8 h-0.5 mx-1 -mt-4
                ${stage.complete ? 'bg-amber-400' : 'bg-amber-200'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

export default WaitingStateDisplay;
