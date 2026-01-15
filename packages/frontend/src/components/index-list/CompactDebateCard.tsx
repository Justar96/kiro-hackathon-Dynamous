import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@thesis/shared';
import { useDebateLinkPrefetch } from '../../lib';
import { InlineQuickStance } from './InlineQuickStance';

/**
 * Card configuration for consistent feed density
 * Requirements: 2.7 - Maximum height constraint for feed density
 */
export const CARD_CONFIG = {
  minHeight: 88,
  maxHeight: 140,
  padding: 12,
  gap: 8,
} as const;

export interface CompactDebateCardProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  userStance?: number | null;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
  isPrefetching?: boolean;
}

/**
 * CompactDebateCard - A compact, Reddit-style card for the debate feed.
 * Shows resolution, status, stance bar, mind changes, and time info.
 * 
 * Requirements: 2.1-2.8 - Compact Debate Card Design
 */
export function CompactDebateCard({
  debate,
  marketPrice,
  userStance,
  onQuickStance,
  isAuthenticated = false,
  isPrefetching = false,
}: CompactDebateCardProps) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;
  const needsOpponent = debate.status === 'active' && !debate.opposeDebaterId;
  const isLive = debate.status === 'active' && debate.opposeDebaterId !== null;
  const isConcluded = debate.status === 'concluded';

  const prefetchProps = useDebateLinkPrefetch(debate.id, { delay: 200 });
  const timeAgo = formatTimeAgo(debate.createdAt);

  const resolutionId = `compact-resolution-${debate.id}`;

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article
        className="relative bg-paper border-b border-divider hover:bg-page-bg/50 active:bg-page-bg transition-colors duration-150"
        style={{
          padding: `${CARD_CONFIG.padding}px ${CARD_CONFIG.padding + 4}px`,
          minHeight: CARD_CONFIG.minHeight,
          maxHeight: CARD_CONFIG.maxHeight,
          contentVisibility: 'auto',
        }}
        aria-labelledby={resolutionId}
        data-testid="compact-debate-card"
      >
        <div className="flex gap-3">
          {/* Left: Stance indicator bar (vertical) */}
          <div className="flex-shrink-0 w-1 rounded-full overflow-hidden bg-divider self-stretch min-h-[48px]">
            <div 
              className="w-full bg-support transition-all duration-300"
              data-testid="support-bar"
              style={{ width: `${supportPercent}%`, height: `${supportPercent}%` }}
            />
            <div 
              className="w-full bg-oppose transition-all duration-300"
              data-testid="oppose-bar"
              style={{ width: `${opposePercent}%`, height: `${opposePercent}%` }}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Top meta row */}
            <div className="flex items-center gap-2 mb-1.5 text-xs">
              {/* Status */}
              <StatusBadge 
                needsOpponent={needsOpponent} 
                isLive={isLive} 
                isConcluded={isConcluded}
                currentRound={debate.currentRound}
              />
              <span className="text-text-tertiary">•</span>
              <span className="text-text-tertiary">{timeAgo}</span>
              {mindChangeCount > 0 && (
                <>
                  <span className="text-text-tertiary">•</span>
                  <span className="text-accent font-medium" data-testid="mind-change-delta">
                    {mindChangeCount} Δ
                  </span>
                </>
              )}
            </div>

            {/* Resolution */}
            <h3
              id={resolutionId}
              className="text-sm text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors"
              data-testid="resolution-text"
            >
              {debate.resolution}
            </h3>

            {/* Bottom row: Stats */}
            <div className="flex items-center gap-4 mt-2">
              {/* Stance percentages */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-support font-medium tabular-nums">{supportPercent}%</span>
                <span className="text-text-tertiary">/</span>
                <span className="text-oppose font-medium tabular-nums">{opposePercent}%</span>
              </div>

              {/* Round progress for active debates */}
              {!isConcluded && !needsOpponent && (
                <span className="text-xs text-text-tertiary" data-testid="round-info">
                  Round {debate.currentRound}/3
                </span>
              )}

              {/* Mini sparkline for market trend */}
              <MiniSparkline supportPercent={supportPercent} />

              {/* Quick stance buttons */}
              {isAuthenticated && onQuickStance && (
                <div
                  className="ml-auto flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="group"
                  aria-label="Quick stance buttons"
                >
                  <InlineQuickStance
                    debateId={debate.id}
                    marketPrice={marketPrice}
                    userStance={userStance}
                    onStance={onQuickStance}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prefetching indicator */}
        {isPrefetching && (
          <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-accent/40 rounded-full animate-pulse" />
        )}
      </article>
    </Link>
  );
}

/**
 * Mini sparkline SVG for market trend visualization
 * Requirements: 2.8 - Sparkline for market trend
 */
function MiniSparkline({ supportPercent }: { supportPercent: number }) {
  // Generate simple sparkline points based on support percent
  const points = [
    { x: 0, y: 50 },
    { x: 25, y: 45 + Math.random() * 10 },
    { x: 50, y: 48 + Math.random() * 10 },
    { x: 75, y: supportPercent - 5 + Math.random() * 10 },
    { x: 100, y: supportPercent },
  ];
  
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 0.4} ${(100 - p.y) * 0.2}`)
    .join(' ');

  return (
    <svg
      data-testid="mini-sparkline"
      className="w-10 h-5 text-accent/50"
      viewBox="0 0 40 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={pathD}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ 
  needsOpponent, 
  isLive, 
  isConcluded,
  currentRound: _currentRound 
}: { 
  needsOpponent: boolean; 
  isLive: boolean; 
  isConcluded: boolean;
  currentRound: number;
}) {
  if (needsOpponent) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
        Open
      </span>
    );
  }
  
  if (isConcluded) {
    return <span className="text-text-tertiary">Resolved</span>;
  }
  
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-medium" data-testid="live-indicator">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        Live
      </span>
    );
  }
  
  return <span className="text-text-secondary">Active</span>;
}

/**
 * Format time ago string
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const created = new Date(date);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default CompactDebateCard;
