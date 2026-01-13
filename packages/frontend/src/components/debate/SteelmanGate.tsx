/**
 * SteelmanGate components for the anti-strawman forcefield.
 * 
 * Per original vision: Before rebuttal, must write steelman of opponent's argument.
 * This makes debates feel "alien compared to Reddit" - forces good faith.
 */

import { useState } from 'react';
import type { Argument } from '@debate-platform/shared';

// ============================================================================
// Steelman Form - Submit a steelman of opponent's argument
// ============================================================================

interface SteelmanFormProps {
  targetArgument: Argument;
  roundNumber: 2 | 3;
  onSubmit: (content: string) => void;
  isSubmitting?: boolean;
  existingSteelman?: {
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
  } | null;
  onDelete?: () => void;
}

export function SteelmanForm({
  targetArgument,
  roundNumber,
  onSubmit,
  isSubmitting = false,
  existingSteelman,
  onDelete,
}: SteelmanFormProps) {
  const [content, setContent] = useState(existingSteelman?.content || '');
  const minLength = 50;
  const maxLength = 500;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length >= minLength) {
      onSubmit(content.trim());
    }
  };

  // Show status if steelman exists
  if (existingSteelman) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {existingSteelman.status === 'pending' && (
              <svg className="w-5 h-5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {existingSteelman.status === 'approved' && (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {existingSteelman.status === 'rejected' && (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-amber-800">
              {existingSteelman.status === 'pending' && 'Waiting for opponent to review your steelman'}
              {existingSteelman.status === 'approved' && 'Steelman approved! You can now submit your argument.'}
              {existingSteelman.status === 'rejected' && 'Steelman rejected'}
            </h4>
            <p className="mt-1 text-sm text-amber-700 italic">"{existingSteelman.content}"</p>
            {existingSteelman.status === 'rejected' && existingSteelman.rejectionReason && (
              <p className="mt-2 text-sm text-red-600">
                Reason: {existingSteelman.rejectionReason}
              </p>
            )}
            {existingSteelman.status === 'rejected' && onDelete && (
              <button
                onClick={onDelete}
                className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
              >
                Delete and try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-amber-800">
            Steelman Gate: Round {roundNumber}
          </h4>
          <p className="text-xs text-amber-700 mt-0.5">
            Before you can respond, demonstrate you understand your opponent's argument in its strongest form.
          </p>
        </div>
      </div>

      {/* Target argument preview */}
      <div className="mb-3 p-3 bg-white/60 rounded border border-amber-100">
        <p className="text-xs text-amber-600 mb-1">Opponent's argument:</p>
        <p className="text-sm text-gray-700 line-clamp-3">{targetArgument.content}</p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="In their strongest form, my opponent is arguing that..."
        className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-white resize-none"
        rows={4}
        maxLength={maxLength}
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${content.length < minLength ? 'text-amber-600' : 'text-gray-500'}`}>
          {content.length}/{maxLength} (min {minLength})
        </span>
        <button
          type="submit"
          disabled={content.trim().length < minLength || isSubmitting}
          className="px-4 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Steelman'}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Steelman Review - Opponent approves/rejects
// ============================================================================

interface SteelmanReviewProps {
  steelman: {
    id: string;
    content: string;
    roundNumber: number;
  };
  targetArgument: Argument;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isSubmitting?: boolean;
}

export function SteelmanReview({
  steelman,
  targetArgument,
  onApprove,
  onReject,
  isSubmitting = false,
}: SteelmanReviewProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(rejectReason.trim());
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-blue-800">
            Review Opponent's Steelman
          </h4>
          <p className="text-xs text-blue-700 mt-0.5">
            Did they accurately represent your argument in its strongest form?
          </p>
        </div>
      </div>

      {/* Your original argument */}
      <div className="mb-3 p-3 bg-white/60 rounded border border-blue-100">
        <p className="text-xs text-blue-600 mb-1">Your argument:</p>
        <p className="text-sm text-gray-700 line-clamp-2">{targetArgument.content}</p>
      </div>

      {/* Their steelman */}
      <div className="mb-4 p-3 bg-white rounded border border-blue-200">
        <p className="text-xs text-blue-600 mb-1">Their steelman:</p>
        <p className="text-sm text-gray-800 italic">"{steelman.content}"</p>
      </div>

      {!showRejectForm ? (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            ✓ Accurate
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            ✗ Not Accurate
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain what they got wrong..."
            className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-300 bg-white resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || isSubmitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Steelman Gate Status Badge
// ============================================================================

interface SteelmanGateBadgeProps {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  roundNumber: number;
}

export function SteelmanGateBadge({ status, roundNumber }: SteelmanGateBadgeProps) {
  const configs = {
    none: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Steelman Required' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Awaiting Review' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Gate Passed' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Revise Steelman' },
  };

  const config = configs[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${config.bg} ${config.text}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      R{roundNumber}: {config.label}
    </span>
  );
}

export default SteelmanForm;
