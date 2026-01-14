import { Link } from '@tanstack/react-router';
import type { Debate, Argument, MarketPrice } from '@debate-platform/shared';
import { DeltaIcon, MindChangeIcon, VoteIcon, ImpactIcon } from '../icons';

interface ResolutionCardProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  topImpactArgument?: Argument | null;
  /** Display variant: 'card' for full card, 'compact' for index row style */
  variant?: 'card' | 'compact';
}

/**
 * ResolutionCard displays a debate resolution with market visualization.
 * Supports two variants:
 * - 'card': Full card with Support/Oppose bar, mind-change count, and most impactful argument preview
 * - 'compact': Compact row layout for index-style lists with calm typography
 * Requirements: 9.2, 12.2
 */
export function ResolutionCard({ 
  debate, 
  marketPrice, 
  topImpactArgument,
  variant = 'card' 
}: ResolutionCardProps) {
  if (variant === 'compact') {
    return <CompactResolutionCard debate={debate} marketPrice={marketPrice} />;
  }

  return <FullResolutionCard debate={debate} marketPrice={marketPrice} topImpactArgument={topImpactArgument} />;
}

/**
 * CompactResolutionCard - Index row style with paper-aesthetic typography.
 * Features serif resolution title, small-caps status, and muted market colors.
 * Requirements: 1.1, 4.1, 8.4, 8.5, 12.2
 */
function CompactResolutionCard({ 
  debate, 
  marketPrice 
}: { 
  debate: Debate; 
  marketPrice?: MarketPrice | null;
}) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;

  const statusLabel = debate.status === 'concluded' ? 'Resolved' : `Round ${debate.currentRound}`;

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
    >
      <article className="flex items-center gap-6 py-5 px-4 border-b border-divider hover:bg-page-bg/50 transition-colors">
        {/* Resolution title - serif font for paper aesthetic */}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-text-primary text-body-large leading-relaxed truncate group-hover:text-accent transition-colors">
            {debate.resolution}
          </h3>
          {/* Small-caps status label for refined metadata styling */}
          <div className="mt-1.5">
            <span className="small-caps text-caption text-text-tertiary">
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Compact support/oppose indicator with muted colors */}
        <div className="w-20 flex-shrink-0">
          <div className="h-2 bg-divider rounded-full overflow-hidden flex">
            <div 
              className="bg-support transition-all duration-300"
              style={{ width: `${supportPercent}%` }}
            />
            <div 
              className="bg-oppose transition-all duration-300"
              style={{ width: `${opposePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-support font-medium tabular-nums">{supportPercent.toFixed(0)}%</span>
            <span className="text-[11px] text-oppose font-medium tabular-nums">{opposePercent.toFixed(0)}%</span>
          </div>
        </div>

        {/* Mind-changes count with delta symbol */}
        <div className="w-20 flex-shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <DeltaIcon size="sm" className="text-text-tertiary" />
            <span className="text-body-small text-text-secondary font-medium tabular-nums">
              {mindChangeCount}
            </span>
          </div>
          <span className="text-caption text-text-tertiary">
            minds
          </span>
        </div>
      </article>
    </Link>
  );
}

/**
 * FullResolutionCard - Full card style with paper-aesthetic typography and refined colors.
 * Features serif resolution title, small-caps status badge, and muted market colors.
 * Requirements: 1.1, 4.1, 8.4, 8.5, 9.2
 */
function FullResolutionCard({ 
  debate, 
  marketPrice, 
  topImpactArgument 
}: { 
  debate: Debate; 
  marketPrice?: MarketPrice | null;
  topImpactArgument?: Argument | null;
}) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;
  const totalVotes = marketPrice?.totalVotes ?? 0;

  const statusLabel = debate.status === 'concluded' ? 'Concluded' : `Round ${debate.currentRound}`;
  const statusColor = debate.status === 'concluded' 
    ? 'bg-page-bg text-text-secondary' 
    : 'bg-accent/10 text-accent';

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="block"
    >
      <article className="bg-paper rounded-subtle border border-divider p-6 hover:border-text-tertiary hover:shadow-paper transition-all">
        {/* Header with status badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="font-heading text-heading-3 text-text-primary leading-snug flex-1">
            {debate.resolution}
          </h3>
          <span className={`small-caps px-2.5 py-1 text-label rounded-subtle whitespace-nowrap ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Support/Oppose Bar with muted colors */}
        <div className="mb-4">
          <div className="flex justify-between text-body-small mb-1.5">
            <span className="text-support font-medium">
              Support {supportPercent.toFixed(0)}%
            </span>
            <span className="text-oppose font-medium">
              Oppose {opposePercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 bg-divider rounded-full overflow-hidden flex">
            <div 
              className="bg-support transition-all duration-300"
              style={{ width: `${supportPercent}%` }}
            />
            <div 
              className="bg-oppose transition-all duration-300"
              style={{ width: `${opposePercent}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-body-small text-text-secondary mb-4">
          <div className="flex items-center gap-1.5">
            <MindChangeIcon size="sm" />
            <span>{mindChangeCount} mind{mindChangeCount !== 1 ? 's' : ''} changed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <VoteIcon size="sm" />
            <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Most impactful argument preview */}
        {topImpactArgument && (
          <div className="pt-4 border-t border-divider">
            <div className="flex items-center gap-2 mb-2">
              <ImpactIcon size="sm" className="text-accent" animate="mount" />
              <span className="small-caps text-label text-accent">
                Most Impactful
              </span>
            </div>
            <p className="text-body-small text-text-secondary line-clamp-2">
              {topImpactArgument.content}
            </p>
            <div className="mt-2 text-caption text-text-tertiary">
              Shifted {topImpactArgument.impactScore.toFixed(0)} mind{topImpactArgument.impactScore !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </article>
    </Link>
  );
}

export default ResolutionCard;
