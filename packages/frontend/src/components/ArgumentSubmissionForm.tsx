/**
 * ArgumentSubmissionForm displays an inline form for debaters to submit arguments.
 * Shows textarea with character counter and correct limit based on round type.
 * 
 * Requirements: 7.2, 7.3
 */

import { useState, useCallback } from 'react';
import { ARGUMENT_CHAR_LIMITS } from '@debate-platform/shared';

export interface ArgumentSubmissionFormProps {
  roundType: 'opening' | 'rebuttal' | 'closing';
  side: 'support' | 'oppose';
  onSubmit: (content: string) => void;
  isSubmitting: boolean;
}

export function ArgumentSubmissionForm({
  roundType,
  side,
  onSubmit,
  isSubmitting,
}: ArgumentSubmissionFormProps) {
  const [content, setContent] = useState('');
  
  const charLimit = ARGUMENT_CHAR_LIMITS[roundType];
  const charCount = content.length;
  const isOverLimit = charCount > charLimit;
  const isEmpty = content.trim().length === 0;
  const canSubmit = !isEmpty && !isOverLimit && !isSubmitting;
  
  const sideConfig = side === 'support' 
    ? { label: 'For', color: 'text-support', borderColor: 'border-support/30', focusBorder: 'focus:border-support' }
    : { label: 'Against', color: 'text-oppose', borderColor: 'border-oppose/30', focusBorder: 'focus:border-oppose' };
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onSubmit(content.trim());
    }
  }, [canSubmit, content, onSubmit]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit(content.trim());
    }
  }, [canSubmit, content, onSubmit]);
  
  return (
    <form onSubmit={handleSubmit} className="mb-8 last:mb-0">
      {/* Side label */}
      <div className="mb-2">
        <span className={`text-label uppercase tracking-wider ${sideConfig.color}`}>
          {sideConfig.label}
        </span>
      </div>
      
      {/* Textarea container */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Write your ${roundType} argument...`}
          disabled={isSubmitting}
          className={`
            w-full min-h-[200px] p-4 
            text-body text-text-primary leading-relaxed
            bg-white border rounded-subtle
            ${sideConfig.borderColor} ${sideConfig.focusBorder}
            focus:outline-none focus:ring-1 focus:ring-opacity-50
            disabled:bg-gray-50 disabled:cursor-not-allowed
            resize-y
            transition-colors
          `}
          aria-label={`${sideConfig.label} argument for ${roundType} round`}
          aria-describedby="char-counter"
        />
        
        {/* Character counter */}
        <div 
          id="char-counter"
          className={`
            absolute bottom-3 right-3 
            text-caption
            ${isOverLimit ? 'text-red-500' : 'text-text-tertiary'}
          `}
        >
          {charCount.toLocaleString()} / {charLimit.toLocaleString()}
        </div>
      </div>
      
      {/* Footer with submit button */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-caption text-text-tertiary">
          Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to submit
        </p>
        
        <button
          type="submit"
          disabled={!canSubmit}
          className={`
            px-4 py-2 
            text-body-small font-medium
            rounded-subtle
            transition-colors
            ${canSubmit 
              ? 'bg-accent text-white hover:bg-accent/90' 
              : 'bg-gray-100 text-text-tertiary cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle 
                  className="opacity-25" 
                  cx="12" cy="12" r="10" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  fill="none" 
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                />
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Argument'
          )}
        </button>
      </div>
    </form>
  );
}

export default ArgumentSubmissionForm;
