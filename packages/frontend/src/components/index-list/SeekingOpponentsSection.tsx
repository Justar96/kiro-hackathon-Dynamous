import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@debate-platform/shared';
import { useDebateLinkPrefetch } from '../../lib/usePrefetch';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

interface SeekingOpponentsSectionProps {
  debates: DebateWithMarket[];
  maxCount?: number;
  currentUserId?: string;
}

/**
 * SeekingOpponentsSection - Highlights debates waiting for an opponent
 * Encourages users to join and start debating
 */
export function SeekingOpponentsSection({ debates, maxCount = 3, currentUserId }: SeekingOpponentsSectionProps) {
  // Filter debates seeking opponents (no opposeDebaterId)
  const seekingOpponents = debates
    .filter(d => 
      d.debate.status === 'active' && 
      !d.debate.opposeDebaterId &&
      d.debate.supportDebaterId !== currentUserId // Don't show user's own debates
    )
    .slice(0, maxCount);

  if (seekingOpponents.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="seeking-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 
          id="seeking-heading" 
          className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" aria-hidden="true" />
          Seeking Opponents
        </h2>
        <span className="text-xs text-accent font-medium">
          {seekingOpponents.length} waiting
        </span>
      </div>
      
      <div className="space-y-2">
        {seekingOpponents.map((item) => (
          <SeekingOpponentCard key={item.debate.id} item={item} />
        ))}
      </div>
    </section>
  );
}

interface SeekingOpponentCardProps {
  item: DebateWithMarket;
}

function SeekingOpponentCard({ item }: SeekingOpponentCardProps) {
  const { debate } = item;
  const prefetchProps = useDebateLinkPrefetch(debate.id);
  
  // Calculate time waiting
  const createdAt = new Date(debate.createdAt);
  const now = new Date();
  const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  const timeLabel = hoursWaiting < 1 
    ? 'Just posted' 
    : hoursWaiting < 24 
      ? `${hoursWaiting}h ago`
      : `${Math.floor(hoursWaiting / 24)}d ago`;

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-accent/40 bg-accent/[0.03] hover:bg-accent/[0.08] hover:border-accent/60 transition-all">
        {/* Pulsing indicator */}
        <div className="flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
          </span>
        </div>
        
        {/* Resolution */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 font-medium line-clamp-1 group-hover:text-accent transition-colors">
            {debate.resolution}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {timeLabel} • Take the <span className="text-rose-500 font-medium">Oppose</span> side
          </p>
        </div>
        
        {/* CTA */}
        <div className="flex-shrink-0">
          <span className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md group-hover:bg-accent-hover transition-colors shadow-sm">
            Accept
          </span>
        </div>
      </article>
    </Link>
  );
}

export default SeekingOpponentsSection;
