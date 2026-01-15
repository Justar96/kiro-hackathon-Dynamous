/**
 * SteelmanGate components for the anti-strawman forcefield.
 * 
 * Per original vision: Before rebuttal, must write steelman of opponent's argument.
 * This makes debates feel "alien compared to Reddit" - forces good faith.
 */

import { useState, useEffect } from 'react';
import type { Argument } from '@thesis/shared';
import { ClockIcon, CheckCircleIcon, XCircleIcon, LightBulbIcon, ShieldCheckIcon } from '../icons';

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

  // Sync content with existingSteelman prop when it changes
  useEffect(() => {
    setContent(existingSteelman?.content || '');
  }, [existingSteelman]);

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
              <ClockIcon size="md" className="text-amber-500" animate="state-change" />
            )}
            {existingSteelman.status === 'approved' && (
              <CheckCircleIcon size="md" className="text-green-500" animate="mount" />
            )}
            {existingSteelman.status === 'rejected' && (
              <XCircleIcon size="md" className="text-red-500" animate="mount" />
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
          <LightBulbIcon size="md" className="text-amber-600" />
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
          <ShieldCheckIcon size="md" className="text-blue-600" />
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
      <ShieldCheckIcon size="xs" animate={status === 'approved' ? 'mount' : 'none'} />
      R{roundNumber}: {config.label}
    </span>
  );
}

export default SteelmanForm;
