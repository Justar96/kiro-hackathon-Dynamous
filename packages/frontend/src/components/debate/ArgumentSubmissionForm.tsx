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
    ? { 
        label: 'For', 
        color: 'text-support', 
        borderColor: 'border-support/20',
        headerBg: 'bg-support/5',
        focusRing: 'focus:ring-support/30',
      }
    : { 
        label: 'Against', 
        color: 'text-oppose', 
        borderColor: 'border-oppose/20',
        headerBg: 'bg-oppose/5',
        focusRing: 'focus:ring-oppose/30',
      };
  
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
    <form 
      onSubmit={handleSubmit} 
      className={`rounded-lg border ${sideConfig.borderColor} bg-white overflow-hidden`}
    >
      {/* Card Header */}
      <div className={`px-5 py-3 border-b ${sideConfig.headerBg} ${sideConfig.borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${sideConfig.color}`}>
            {sideConfig.label}
          </span>
          <span className="text-xs text-text-tertiary">— Your turn</span>
        </div>
        
        {/* Character counter in header */}
        <span 
          id="char-counter"
          className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : 'text-text-tertiary'}`}
        >
          {charCount.toLocaleString()} / {charLimit.toLocaleString()}
        </span>
      </div>
      
      {/* Card Body - Textarea */}
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Write your ${roundType} argument...`}
          disabled={isSubmitting}
          className={`
            w-full min-h-[180px] p-3
            text-body text-text-primary leading-relaxed
            bg-gray-50/50 border border-gray-200 rounded-lg
            focus:outline-none focus:ring-2 ${sideConfig.focusRing} focus:border-transparent focus:bg-white
            disabled:bg-gray-100 disabled:cursor-not-allowed
            resize-y
            transition-all
          `}
          aria-label={`${sideConfig.label} argument for ${roundType} round`}
          aria-describedby="char-counter"
        />
      </div>
      
      {/* Card Footer - Submit actions */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
        <p className="text-xs text-text-tertiary hidden sm:block">
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">Enter</kbd>
          <span className="ml-1.5">to submit</span>
        </p>
        
        <button
          type="submit"
          disabled={!canSubmit}
          className={`
            px-5 py-2 
            text-sm font-medium
            rounded-lg
            transition-all
            ${canSubmit 
              ? 'bg-accent text-white hover:bg-accent/90 shadow-sm' 
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
