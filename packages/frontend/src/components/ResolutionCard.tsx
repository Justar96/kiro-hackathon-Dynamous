import { Link } from '@tanstack/react-router';
import type { Debate, Argument, MarketPrice } from '@debate-platform/shared';

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
 * CompactResolutionCard - Index row style with calm typography and generous spacing.
 * Requirements: 12.2
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
      <article className="flex items-center gap-6 py-5 px-4 border-b border-gray-100 hover:bg-page-bg/50 transition-colors">
        {/* Resolution title - main content with generous spacing */}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-text-primary text-body-large leading-relaxed truncate group-hover:text-accent transition-colors">
            {debate.resolution}
          </h3>
          {/* Muted status tag */}
          <div className="mt-1.5">
            <span className="text-caption text-text-tertiary">
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Compact support/oppose indicator */}
        <div className="w-20 flex-shrink-0">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
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
            <span className="text-[11px] text-support font-medium">{supportPercent.toFixed(0)}%</span>
            <span className="text-[11px] text-oppose font-medium">{opposePercent.toFixed(0)}%</span>
          </div>
        </div>

        {/* Mind-changes count with delta symbol */}
        <div className="w-20 flex-shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <DeltaIcon className="w-3.5 h-3.5 text-text-tertiary" />
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
 * FullResolutionCard - Original card style with full details.
 * Requirements: 9.2
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
    ? 'bg-gray-100 text-gray-600' 
    : 'bg-blue-50 text-blue-600';

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="block"
    >
      <article className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all">
        {/* Header with status badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900 leading-snug flex-1">
            {debate.resolution}
          </h3>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Support/Oppose Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-emerald-600 font-medium">
              Support {supportPercent.toFixed(0)}%
            </span>
            <span className="text-rose-600 font-medium">
              Oppose {opposePercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${supportPercent}%` }}
            />
            <div 
              className="bg-rose-500 transition-all duration-300"
              style={{ width: `${opposePercent}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <MindChangeIcon className="w-4 h-4" />
            <span>{mindChangeCount} mind{mindChangeCount !== 1 ? 's' : ''} changed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <VoteIcon className="w-4 h-4" />
            <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Most impactful argument preview */}
        {topImpactArgument && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <ImpactIcon className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                Most Impactful
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {topImpactArgument.content}
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Shifted {topImpactArgument.impactScore.toFixed(0)} mind{topImpactArgument.impactScore !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </article>
    </Link>
  );
}

// Icon components
function MindChangeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function VoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ImpactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DeltaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4L4 20h16L12 4z" />
    </svg>
  );
}

export default ResolutionCard;
