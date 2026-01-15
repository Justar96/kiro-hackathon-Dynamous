/**
 * ReactionDisplay Component
 * 
 * Displays aggregate reaction counts for arguments with privacy-compliant design.
 * Per Requirement 6.3: Shows aggregate counts only, no user indicators.
 * 
 * Features:
 * - Shows "Agree" and "Strong Reasoning" reaction counts
 * - Allows authenticated users to add/remove their own reactions
 * - Never exposes who reacted - only aggregate counts
 */

import { useCallback } from 'react';
import { useReactions } from '../../lib/hooks/data/useReactions';
import { useOptimisticReaction } from '../../lib/hooks/optimistic/useOptimisticReaction';
import { useAuthToken } from '../../lib/hooks/data/useAuthToken';
import { CheckIcon, LightBulbIcon } from '../icons';

interface ReactionDisplayProps {
  /** The argument ID to display reactions for */
  argumentId: string;
  /** Whether to show the reaction buttons (false for read-only display) */
  interactive?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * ReactionDisplay shows aggregate reaction counts for an argument.
 * 
 * Privacy Compliance (Requirement 6.3):
 * - Only displays aggregate counts (agree: N, strongReasoning: M)
 * - Never shows who reacted or any user identifiers
 * - User's own reaction state is shown only to enable toggle behavior
 */
export function ReactionDisplay({ 
  argumentId, 
  interactive = true,
  compact = false,
}: ReactionDisplayProps) {
  const token = useAuthToken();
  const isAuthenticated = !!token;
  
  const { data: reactions, isLoading } = useReactions(argumentId);
  const { addReaction, removeReaction, isPending } = useOptimisticReaction({ argumentId });
  
  const handleAgreeClick = useCallback(() => {
    if (!isAuthenticated || isPending) return;
    
    if (reactions?.userReactions?.agree) {
      removeReaction('agree');
    } else {
      addReaction('agree');
    }
  }, [isAuthenticated, isPending, reactions?.userReactions?.agree, addReaction, removeReaction]);
  
  const handleStrongReasoningClick = useCallback(() => {
    if (!isAuthenticated || isPending) return;
    
    if (reactions?.userReactions?.strongReasoning) {
      removeReaction('strong_reasoning');
    } else {
      addReaction('strong_reasoning');
    }
  }, [isAuthenticated, isPending, reactions?.userReactions?.strongReasoning, addReaction, removeReaction]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-text-tertiary animate-pulse">Loading reactions...</span>
      </div>
    );
  }
  
  const agreeCount = reactions?.counts?.agree ?? 0;
  const strongReasoningCount = reactions?.counts?.strongReasoning ?? 0;
  const userAgreed = reactions?.userReactions?.agree ?? false;
  const userStrongReasoning = reactions?.userReactions?.strongReasoning ?? false;
  
  // Non-interactive display (read-only aggregate counts)
  if (!interactive || !isAuthenticated) {
    return (
      <div className={`flex items-center gap-4 ${compact ? 'text-xs' : 'text-sm'}`}>
        <ReactionCount
          icon={<CheckIcon size={compact ? 'xs' : 'sm'} decorative />}
          count={agreeCount}
          label="Agree"
          compact={compact}
        />
        <ReactionCount
          icon={<LightBulbIcon size={compact ? 'xs' : 'sm'} decorative />}
          count={strongReasoningCount}
          label="Strong Reasoning"
          compact={compact}
        />
      </div>
    );
  }
  
  // Interactive display with buttons
  return (
    <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      <ReactionButton
        icon={<CheckIcon size={compact ? 'xs' : 'sm'} decorative />}
        count={agreeCount}
        label="Agree"
        active={userAgreed}
        onClick={handleAgreeClick}
        disabled={isPending}
        compact={compact}
      />
      <ReactionButton
        icon={<LightBulbIcon size={compact ? 'xs' : 'sm'} decorative />}
        count={strongReasoningCount}
        label="Strong Reasoning"
        active={userStrongReasoning}
        onClick={handleStrongReasoningClick}
        disabled={isPending}
        compact={compact}
      />
    </div>
  );
}

/**
 * ReactionCount - Read-only display of aggregate count
 * Shows only the count, no user information
 */
interface ReactionCountProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  compact?: boolean;
}

function ReactionCount({ icon, count, label, compact = false }: ReactionCountProps) {
  return (
    <span 
      className={`flex items-center gap-1.5 text-text-tertiary ${compact ? 'text-xs' : 'text-sm'}`}
      title={`${count} ${label}`}
      aria-label={`${count} ${label} reactions`}
    >
      {icon}
      <span>{count}</span>
    </span>
  );
}

/**
 * ReactionButton - Interactive button for adding/removing reactions
 * Shows aggregate count and allows toggle, but never reveals other users
 */
interface ReactionButtonProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function ReactionButton({ 
  icon, 
  count, 
  label, 
  active, 
  onClick, 
  disabled = false,
  compact = false,
}: ReactionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md
        min-h-[44px] min-w-[44px]
        motion-safe:transition-colors motion-reduce:transition-none
        ${compact ? 'text-xs' : 'text-sm'}
        ${active 
          ? 'bg-accent/10 text-accent border border-accent/30' 
          : 'text-text-tertiary hover:text-text-secondary hover:bg-page-bg border border-transparent'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={active ? `Remove ${label}` : `Add ${label}`}
      aria-label={`${active ? 'Remove' : 'Add'} ${label} reaction. Current count: ${count}`}
      aria-pressed={active}
    >
      {icon}
      <span>{count}</span>
    </button>
  );
}

export default ReactionDisplay;
