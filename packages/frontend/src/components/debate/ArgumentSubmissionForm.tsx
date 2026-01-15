/**
 * ArgumentSubmissionForm displays an inline form for debaters to submit arguments.
 * Shows textarea with character counter and correct limit based on round type.
 * Includes media attachment support for rich evidence.
 * 
 * Requirements: 2.1, 2.4, 7.2, 7.3
 */

import { useState, useCallback } from 'react';
import { ARGUMENT_CHAR_LIMITS } from '@thesis/shared';
import { SpinnerIcon } from '../icons';
import { MediaUploader } from './MediaUploader';
import type { PendingMedia } from './MediaPreview';

export interface ArgumentSubmissionFormProps {
  roundType: 'opening' | 'rebuttal' | 'closing';
  side: 'support' | 'oppose';
  /** Callback when form is submitted. Receives content and optional media attachments. */
  onSubmit: (content: string, media?: PendingMedia[]) => void;
  isSubmitting: boolean;
  /** Whether to show media uploader section */
  showMediaUploader?: boolean;
}

export function ArgumentSubmissionForm({
  roundType,
  side,
  onSubmit,
  isSubmitting,
  showMediaUploader = true,
}: ArgumentSubmissionFormProps) {
  const [content, setContent] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<PendingMedia[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
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
      onSubmit(content.trim(), attachedMedia.length > 0 ? attachedMedia : undefined);
    }
  }, [canSubmit, content, attachedMedia, onSubmit]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit(content.trim(), attachedMedia.length > 0 ? attachedMedia : undefined);
    }
  }, [canSubmit, content, attachedMedia, onSubmit]);

  // Media handlers
  const handleMediaAdded = useCallback((media: PendingMedia) => {
    setAttachedMedia((prev) => [...prev, media]);
    setMediaError(null);
  }, []);

  const handleMediaRemoved = useCallback((mediaId: string) => {
    setAttachedMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }, []);

  const handleMediaError = useCallback((error: string) => {
    setMediaError(error);
    // Clear error after 5 seconds
    setTimeout(() => setMediaError(null), 5000);
  }, []);
  
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
        
        {/* Media Attachment Section - Requirements 2.1, 2.4 */}
        {showMediaUploader && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm font-medium text-text-secondary">Add Evidence</span>
            </div>
            
            {/* Media error message */}
            {mediaError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{mediaError}</p>
              </div>
            )}
            
            <MediaUploader
              onMediaAdded={handleMediaAdded}
              onMediaRemoved={handleMediaRemoved}
              onError={handleMediaError}
              attachedMedia={attachedMedia}
              disabled={isSubmitting}
              maxFiles={5}
            />
          </div>
        )}
      </div>
      
      {/* Card Footer - Submit actions */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
        {/* Desktop keyboard hint (hidden on mobile), Mobile touch hint (visible on small screens) */}
        <p className="text-xs text-text-tertiary">
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">⌘</kbd>
            <span className="mx-1">+</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">Enter</kbd>
            <span className="ml-1.5">to submit</span>
          </span>
          <span className="sm:hidden">Tap Submit when ready</span>
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
              <SpinnerIcon size="sm" className="animate-spin" decorative />
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
