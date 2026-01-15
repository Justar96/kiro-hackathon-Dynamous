import { useState, useCallback } from 'react';
import type { StanceValue } from '@thesis/shared';
import { STANCE_LEVELS, valueToStanceLevel } from '@thesis/shared';

interface SimpleStanceInputProps {
  type: 'pre' | 'post';
  initialValue?: number;
  onSubmit: (stance: StanceValue) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Simplified 5-point stance input with paper-clean aesthetic.
 * Polymarket-style simplicity: just pick a position.
 */
export function SimpleStanceInput({
  type,
  initialValue,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  compact = false,
}: SimpleStanceInputProps) {
  const [selected, setSelected] = useState<number | null>(initialValue ?? null);
  const isLocked = initialValue !== undefined;

  const handleSelect = useCallback((value: number) => {
    if (disabled || isSubmitting || isLocked) return;
    setSelected(value);
  }, [disabled, isSubmitting, isLocked]);

  const handleSubmit = useCallback(() => {
    if (selected === null) return;
    onSubmit({ supportValue: selected, confidence: 3 });
  }, [selected, onSubmit]);

  // Locked state - show recorded stance
  if (isLocked && initialValue !== undefined) {
    const level = valueToStanceLevel(initialValue);
    const levelData = STANCE_LEVELS.find(s => s.level === level);
    
    return (
      <div className="bg-paper border border-hairline rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-label uppercase tracking-wider text-text-secondary">
            {type === 'pre' ? 'Initial Position' : 'Final Position'}
          </span>
          <span className="text-support text-sm">✓ Recorded</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-body font-medium ${
            initialValue > 50 ? 'text-support' : initialValue < 50 ? 'text-oppose' : 'text-text-secondary'
          }`}>
            {levelData?.label}
          </span>
          <div className="flex-1 h-1.5 bg-page-bg rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${initialValue > 50 ? 'bg-support' : initialValue < 50 ? 'bg-oppose' : 'bg-text-tertiary'}`}
              style={{ width: `${initialValue}%` }}
            />
          </div>
          <span className="text-caption text-text-tertiary w-8 text-right">{initialValue}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-paper border border-hairline rounded-lg ${compact ? 'p-3' : 'p-5'}`}>
      {!compact && (
        <div className="mb-4">
          <h3 className="text-body font-medium text-text-primary">
            {type === 'pre' ? "What's your initial take?" : 'Has your view changed?'}
          </h3>
          <p className="text-caption text-text-secondary mt-1">
            {type === 'pre' ? 'Record your position before reading' : 'Update after reading the arguments'}
          </p>
        </div>
      )}

      {/* 5-point scale buttons */}
      <div className={`grid ${compact ? 'grid-cols-5 gap-1' : 'grid-cols-5 gap-2'}`}>
        {STANCE_LEVELS.map(({ level, value, label, short }) => {
          const isSelected = selected === value;
          const colorClass = value > 50 
            ? 'border-support bg-support/5 text-support' 
            : value < 50 
              ? 'border-oppose bg-oppose/5 text-oppose'
              : 'border-text-tertiary bg-page-bg text-text-secondary';
          
          return (
            <button
              key={level}
              type="button"
              onClick={() => handleSelect(value)}
              disabled={disabled || isSubmitting}
              className={`
                ${compact ? 'py-2 px-1' : 'py-3 px-2'} rounded-lg border-2 transition-all text-center
                ${isSelected ? colorClass : 'border-hairline hover:border-black/20 bg-paper text-text-secondary'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium leading-tight`}>
                {compact ? short : label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {selected !== null && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting}
          className={`
            w-full ${compact ? 'mt-2 py-2' : 'mt-4 py-2.5'} px-4 
            bg-text-primary text-paper text-body-small font-medium rounded-lg 
            hover:bg-text-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSubmitting ? 'Recording...' : 'Lock In Position'}
        </button>
      )}
    </div>
  );
}

export default SimpleStanceInput;
