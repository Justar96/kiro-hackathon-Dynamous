/**
 * ArgumentAttributionPrompt Component
 * 
 * Shows after post-stance submission to allow users to attribute
 * which argument influenced them most.
 * 
 * Per Requirement 6.2: When a spectator records a post-stance, 
 * THE Debate_Platform SHALL prompt them to attribute which argument 
 * influenced them most.
 */

import { useState, useCallback } from 'react';
import type { Argument } from '@thesis/shared';
import { Modal } from '../common/Modal';
import { LightBulbIcon, CheckIcon } from '../icons';

export interface ArgumentAttributionPromptProps {
  /** Whether the prompt is visible */
  isOpen: boolean;
  /** Callback when the prompt is closed */
  onClose: () => void;
  /** Available arguments to attribute impact to */
  arguments: Argument[];
  /** Callback when an argument is selected */
  onAttributeImpact: (argumentId: string) => void;
  /** Whether attribution is being submitted */
  isSubmitting?: boolean;
  /** The user's stance delta (change from pre to post) */
  stanceDelta?: number;
}

/**
 * ArgumentAttributionPrompt prompts users to select which argument
 * influenced their stance change the most after recording a post-stance.
 */
export function ArgumentAttributionPrompt({
  isOpen,
  onClose,
  arguments: availableArguments,
  onAttributeImpact,
  isSubmitting = false,
  stanceDelta,
}: ArgumentAttributionPromptProps) {
  const [selectedArgumentId, setSelectedArgumentId] = useState<string | null>(null);
  
  const handleSubmit = useCallback(() => {
    if (selectedArgumentId) {
      onAttributeImpact(selectedArgumentId);
    }
  }, [selectedArgumentId, onAttributeImpact]);
  
  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);
  
  // Don't show if no arguments available
  if (availableArguments.length === 0) {
    return null;
  }
  
  // Determine if user's mind changed significantly
  const mindChanged = stanceDelta !== undefined && Math.abs(stanceDelta) >= 10;
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-divider">
          <h2 className="text-lg font-semibold text-text-primary">What influenced you?</h2>
        </div>
        
        {/* Header message */}
        <div className="text-center pb-2">
          {mindChanged ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
                <LightBulbIcon size="lg" className="text-accent" animate="mount" />
              </div>
              <p className="text-body text-text-primary">
                Your stance changed by <span className="font-semibold text-accent">{stanceDelta! > 0 ? '+' : ''}{stanceDelta}</span> points!
              </p>
              <p className="text-body-small text-text-secondary mt-1">
                Which argument influenced you the most?
              </p>
            </>
          ) : (
            <>
              <p className="text-body text-text-primary">
                Thanks for recording your stance!
              </p>
              <p className="text-body-small text-text-secondary mt-1">
                Did any argument stand out to you?
              </p>
            </>
          )}
        </div>
        
        {/* Argument selection */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableArguments.map((argument) => (
            <ArgumentOption
              key={argument.id}
              argument={argument}
              isSelected={selectedArgumentId === argument.id}
              onSelect={() => setSelectedArgumentId(argument.id)}
            />
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-2.5 px-4 text-text-secondary hover:text-text-primary border border-divider rounded-lg transition-colors min-h-[44px]"
            disabled={isSubmitting}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedArgumentId || isSubmitting}
            className="flex-1 py-2.5 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? 'Submitting...' : 'Attribute Impact'}
          </button>
        </div>
        
        {/* Privacy note */}
        <p className="text-caption text-text-tertiary text-center">
          Your attribution helps measure argument effectiveness. It won't be publicly linked to you.
        </p>
      </div>
    </Modal>
  );
}

/**
 * ArgumentOption displays a selectable argument card
 */
interface ArgumentOptionProps {
  argument: Argument;
  isSelected: boolean;
  onSelect: () => void;
}

function ArgumentOption({ argument, isSelected, onSelect }: ArgumentOptionProps) {
  const sideConfig = argument.side === 'support'
    ? { label: 'For', color: 'text-support', bgColor: 'bg-support/5', borderColor: 'border-support/30' }
    : { label: 'Against', color: 'text-oppose', bgColor: 'bg-oppose/5', borderColor: 'border-oppose/30' };
  
  // Truncate content for display
  const truncatedContent = argument.content.length > 150
    ? argument.content.slice(0, 150) + '...'
    : argument.content;
  
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left p-3 rounded-lg border-2 transition-all
        ${isSelected 
          ? `${sideConfig.bgColor} ${sideConfig.borderColor}` 
          : 'border-divider hover:border-divider/80 bg-paper'
        }
      `}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div className={`
          flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5
          ${isSelected 
            ? `${sideConfig.borderColor.replace('border-', 'border-')} ${sideConfig.bgColor}` 
            : 'border-divider'
          }
        `}>
          {isSelected && (
            <CheckIcon size="xs" className={sideConfig.color} decorative />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${sideConfig.color} uppercase tracking-wide`}>
              {sideConfig.label}
            </span>
            {argument.impactScore > 0 && (
              <span className="text-xs text-text-tertiary">
                Impact: +{argument.impactScore}
              </span>
            )}
          </div>
          <p className="text-sm text-text-primary leading-relaxed">
            {truncatedContent}
          </p>
        </div>
      </div>
    </button>
  );
}

export default ArgumentAttributionPrompt;
