import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@thesis/shared';
import { useDebateLinkPrefetch } from '../../lib';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

export interface TrendingRailProps {
  /** Array of debates with market data */
  debates: DebateWithMarket[];
  /** Maximum number of items to display (default: 5) */
  maxCount?: number;
}

/**
 * TrendingRail - Compact trending debates list for right rail
 * 
 * Requirements:
 * - 4.1: Relocate trending section to right rail
 * - 4.2: Compact list format (not cards)
 * - 4.3: Show resolution, support %, mind changes
 * - 4.4: Sort by activity (mind changes, recency)
 */
export function TrendingRail({ debates, maxCount = 5 }: TrendingRailProps) {
  // Filter active debates and sort by mind changes (activity), then recency
  // Requirements: 4.4 - Sort by activity (mind changes, recency)
  const trendingDebates = [...debates]
    .filter(d => d.debate.status === 'active')
    .sort((a, b) => {
      const aCount = a.marketPrice?.mindChangeCount ?? 0;
      const bCount = b.marketPrice?.mindChangeCount ?? 0;
      // Primary sort: mind changes (descending)
      if (bCount !== aCount) return bCount - aCount;
      // Secondary sort: recency (descending)
      return new Date(b.debate.createdAt).getTime() - new Date(a.debate.createdAt).getTime();
    })
    .slice(0, maxCount);

  if (trendingDebates.length === 0) {
    return null;
  }

  return (
    <section 
      className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper"
      aria-labelledby="trending-rail-heading"
      data-testid="trending-rail"
    >
      <div className="px-4 py-3 border-b border-divider">
        <h2 
          id="trending-rail-heading"
          className="small-caps text-label text-text-secondary flex items-center gap-2"
        >
          <span 
            className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" 
            aria-hidden="true"
            data-testid="trending-indicator"
          />
          Trending Now
        </h2>
      </div>
      
      <ul className="divide-y divide-divider" data-testid="trending-list">
        {trendingDebates.map((item, index) => (
          <TrendingRailItem 
            key={item.debate.id} 
            item={item} 
            rank={index + 1}
          />
        ))}
      </ul>
    </section>
  );
}

interface TrendingRailItemProps {
  item: DebateWithMarket;
  rank: number;
}

/**
 * Individual trending item in compact list format
 * Requirements: 4.2, 4.3 - Compact format with resolution, support %, mind changes
 */
function TrendingRailItem({ item, rank }: TrendingRailItemProps) {
  const { debate, marketPrice } = item;
  const prefetchProps = useDebateLinkPrefetch(debate.id, { delay: 200 });
  
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;

  return (
    <li>
      <Link
        to="/debates/$debateId"
        params={{ debateId: debate.id }}
        // Requirements: 6.3 - Touch-friendly tap targets of at least 44px
        className="group flex items-start gap-3 px-4 py-3 min-h-[44px] hover:bg-page-bg/50 active:bg-page-bg transition-colors"
        {...prefetchProps}
        data-testid="trending-item"
      >
        {/* Rank indicator */}
        <span 
          className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]"
          aria-label={`Rank ${rank}`}
          data-testid="trending-rank"
        >
          {rank}
        </span>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Resolution - truncated to 2 lines */}
          {/* Requirements: 4.3 - Show resolution */}
          <p 
            className="text-sm text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors"
            data-testid="trending-resolution"
          >
            {debate.resolution}
          </p>
          
          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5">
            {/* Support percentage */}
            {/* Requirements: 4.3 - Show support % */}
            <span 
              className="text-xs text-support font-medium"
              data-testid="trending-support"
            >
              {supportPercent.toFixed(0)}% support
            </span>
            
            {/* Mind changes */}
            {/* Requirements: 4.3 - Show mind changes */}
            {mindChangeCount > 0 && (
              <span 
                className="text-xs text-accent font-medium flex items-center gap-0.5"
                data-testid="trending-mind-changes"
              >
                <span className="tabular-nums">{mindChangeCount}</span>
                <span className="text-[10px]">Δ</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default TrendingRail;
