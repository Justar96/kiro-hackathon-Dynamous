import { useState, useCallback, useEffect } from 'react';
import type { StanceValue } from '@debate-platform/shared';

interface StanceInputProps {
  debateId: string;
  type: 'pre' | 'post';
  initialValue?: StanceValue;
  onSubmit: (stance: StanceValue) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  locked?: boolean;
  beforeValue?: number;
  afterUnlocked?: boolean;
  /** Simplified mode for new users - hides confidence selector */
  simplified?: boolean;
}

const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Very Uncertain', description: 'Just guessing' },
  { value: 2, label: 'Somewhat Uncertain', description: 'Leaning this way' },
  { value: 3, label: 'Neutral', description: 'Could go either way' },
  { value: 4, label: 'Somewhat Confident', description: 'Fairly sure' },
  { value: 5, label: 'Very Confident', description: 'Strongly believe this' },
] as const;

/**
 * StanceInput captures user's stance on a debate resolution.
 * Provides a slider for Support (0-100) and confidence level selector.
 * Handles both pre-read (Before) and post-read (After) stance modes.
 * 
 * Before/After Flow:
 * - Before slider appears at top, locks with subtle check after set
 * - After slider unlocks after scrolling past Round 2
 * - Delta label (Δ +12) shown after both stances recorded
 * 
 * Requirements: 3.1, 3.2, 11.1, 11.2, 11.3, 11.4, 11.5
 */
export function StanceInput({ 
  type, 
  initialValue, 
  onSubmit, 
  isSubmitting = false,
  disabled = false,
  locked = false,
  beforeValue,
  afterUnlocked = true,
  simplified = false,
}: StanceInputProps) {
  const [supportValue, setSupportValue] = useState(initialValue?.supportValue ?? 50);
  const [confidence, setConfidence] = useState(initialValue?.confidence ?? 3);

  // Update local state when initialValue changes (e.g., after submission)
  useEffect(() => {
    if (initialValue) {
      setSupportValue(initialValue.supportValue);
      setConfidence(initialValue.confidence ?? 3);
    }
  }, [initialValue]);

  const handleSubmit = useCallback(() => {
    onSubmit({ supportValue, confidence });
  }, [supportValue, confidence, onSubmit]);

  const opposeValue = 100 - supportValue;
  const isPreStance = type === 'pre';
  const isPostStance = type === 'post';
  
  // Calculate delta for After stance display
  const delta = isPostStance && beforeValue !== undefined && initialValue?.supportValue !== undefined
    ? initialValue.supportValue - beforeValue
    : null;

  // Determine if the input should be interactive
  const isLocked = locked || (isPostStance && !afterUnlocked);
  const isInteractive = !isLocked && !disabled && !isSubmitting;

  // Locked Before stance display (compact with check)
  if (isPreStance && locked && initialValue) {
    return (
      <div className="bg-paper rounded-lg border border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Before</h3>
          <span className="text-support text-sm" aria-label="Stance locked">✓</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 bg-page-bg rounded-full overflow-hidden">
              <div 
                className="h-full bg-text-secondary transition-all"
                style={{ width: `${initialValue.supportValue}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-text-primary w-12 text-right">
            {initialValue.supportValue}%
          </span>
        </div>
        <p className="mt-2 text-xs text-text-tertiary">
          Your initial stance has been recorded
        </p>
      </div>
    );
  }

  // Locked After stance display (waiting for scroll unlock)
  if (isPostStance && !afterUnlocked && !initialValue) {
    return (
      <div className="bg-paper rounded-lg border border-hairline p-4 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">After</h3>
        </div>
        <div className="h-2 bg-page-bg rounded-full" />
        <p className="mt-2 text-xs text-text-tertiary italic">
          Keep reading to unlock
        </p>
      </div>
    );
  }

  // After stance already recorded (show with delta)
  if (isPostStance && initialValue && delta !== null) {
    return (
      <div className="bg-paper rounded-lg border border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">After</h3>
          <DeltaLabel delta={delta} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 bg-page-bg rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all"
                style={{ width: `${initialValue.supportValue}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-text-primary w-12 text-right">
            {initialValue.supportValue}%
          </span>
        </div>
        {/* Update stance button - 44px minimum touch target for accessibility (Requirement 8.4) */}
        <button
          onClick={() => onSubmit({ supportValue, confidence })}
          className="mt-2 min-h-[44px] px-2 text-xs text-accent hover:underline inline-flex items-center"
        >
          Update stance
        </button>
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-lg border border-hairline p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-text-primary mb-1">
          {isPreStance ? 'Record Your Initial Stance' : 'Update Your Stance'}
        </h3>
        <p className="text-sm text-text-secondary">
          {isPreStance 
            ? 'Before reading the arguments, where do you stand on this resolution?'
            : 'After reading the arguments, has your position changed?'
          }
        </p>
      </div>

      {/* Support/Oppose Slider */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <div className="text-center">
            <span className="text-2xl font-semibold text-support">{supportValue}%</span>
            <p className="text-sm text-text-secondary">Support</p>
          </div>
          <div className="text-center">
            <span className="text-2xl font-semibold text-oppose">{opposeValue}%</span>
            <p className="text-sm text-text-secondary">Oppose</p>
          </div>
        </div>

        {/* Custom slider */}
        <div className="relative">
          <div className="h-3 bg-page-bg rounded-full overflow-hidden">
            <div 
              className="h-full bg-support transition-all duration-150"
              style={{ width: `${supportValue}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={supportValue}
            onChange={(e) => setSupportValue(Number(e.target.value))}
            disabled={!isInteractive}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Support percentage"
          />
          {/* Slider thumb indicator */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-paper border-2 border-support rounded-full shadow-sm pointer-events-none transition-all duration-150"
            style={{ left: `calc(${supportValue}% - 10px)` }}
          />
        </div>

        {/* Quick select buttons - 44px minimum touch target for accessibility (Requirement 8.4) */}
        <div className="flex justify-between mt-3">
          {[0, 25, 50, 75, 100].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSupportValue(value)}
              disabled={!isInteractive}
              className={`min-w-[44px] min-h-[44px] px-3 text-xs rounded-full transition-colors inline-flex items-center justify-center ${
                supportValue === value
                  ? 'bg-support/10 text-support font-medium'
                  : 'bg-page-bg text-text-secondary hover:bg-page-bg/80'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {value}%
            </button>
          ))}
        </div>
      </div>

      {/* Confidence Level - hidden in simplified mode */}
      {!simplified && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-3">
            How confident are you in this position?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {CONFIDENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setConfidence(level.value)}
                disabled={!isInteractive}
                className={`min-h-[44px] p-3 rounded-lg border-2 transition-all text-center ${
                  confidence === level.value
                    ? 'border-accent bg-accent/10'
                    : 'border-hairline hover:border-black/[0.12] bg-paper'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="text-lg mb-1">
                  {level.value === 1 && '😕'}
                  {level.value === 2 && '🤔'}
                  {level.value === 3 && '😐'}
                  {level.value === 4 && '🙂'}
                  {level.value === 5 && '😎'}
                </div>
                <div className="text-xs font-medium text-text-primary leading-tight">
                  {level.label}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-secondary text-center">
            {CONFIDENCE_LEVELS.find(l => l.value === confidence)?.description}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isInteractive}
        className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner className="w-4 h-4" />
            Submitting...
          </span>
        ) : (
          isPreStance ? 'Lock In' : 'Record'
        )}
      </button>

      {/* Info text */}
      {isPreStance && (
        <p className="mt-4 text-xs text-text-tertiary text-center">
          Your initial stance will be recorded before you see the debate arguments.
          This helps measure how persuasive the arguments are.
        </p>
      )}
    </div>
  );
}

/**
 * DeltaLabel displays the stance change (Δ +12 or Δ -8)
 * This is the signature interaction showing how minds changed.
 * Requirements: 11.4, 11.5
 */
export function DeltaLabel({ delta, className = '' }: { delta: number; className?: string }) {
  const sign = delta > 0 ? '+' : '';
  const colorClass = delta > 0 
    ? 'text-support' 
    : delta < 0 
      ? 'text-oppose' 
      : 'text-text-secondary';
  
  return (
    <span 
      className={`text-sm font-medium ${colorClass} ${className}`}
      title={`Stance changed by ${sign}${delta} points`}
    >
      Δ {sign}{delta}
    </span>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
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
  );
}

export default StanceInput;
